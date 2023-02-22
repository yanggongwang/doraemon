package main

import (
	"context"
	"doraemon/cmd/alert-gateway/inhibit"
	"doraemon/cmd/alert-gateway/initial"
	"doraemon/cmd/alert-gateway/models"
	doraemonSilence "doraemon/cmd/alert-gateway/silence"
	"doraemon/pkg/auth/ldaputil"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/astaxie/beego"
	"github.com/astaxie/beego/logs"
	"github.com/go-ldap/ldap"

	_ "doraemon/cmd/alert-gateway/logs"
	_ "doraemon/cmd/alert-gateway/routers"

	_ "github.com/go-kit/kit/log"
	"github.com/go-kit/log"
	"github.com/go-kit/log/level"

	"github.com/prometheus/alertmanager/provider/mem"
	alertmanagerSlience "github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/promlog"
)

func parseLdapScope(scope string) int {
	switch scope {
	case "0":
		return ldap.ScopeBaseObject
	case "1":
		return ldap.ScopeSingleLevel
	case "2":
		return ldap.ScopeWholeSubtree
	default:
		return ldap.ScopeWholeSubtree
	}
}

func main() {
	run()
}

func run() {
	if beego.BConfig.RunMode == "dev" {
		beego.BConfig.WebConfig.DirectoryIndex = true
		beego.BConfig.WebConfig.StaticDir["/swagger"] = "swagger"
	}

	cfg, err := beego.AppConfig.GetSection("auth.ldap")
	if err != nil {
		logs.Warn("ldap config error: %v, ldap will not be supported", err)
	} else if cfg != nil && cfg["enabled"] == "true" {
		ldapCfg := ldaputil.LdapConfig{
			Url:          cfg["ldap_url"],
			BaseDN:       cfg["ldap_base_dn"],
			Scope:        parseLdapScope(cfg["ldap_scope"]),
			BindUsername: cfg["ldap_search_dn"],
			BindPassword: cfg["ldap_search_password"],
			Filter:       cfg["ldap_filter"],
		}
		ldaputil.InitLdap(&ldapCfg)
	}

	initial.InitDb()
	logger := promlog.New(&promlog.Config{})
	alertGCInterval := time.Minute * 30
	marker := initial.GetMarker()
	inhibit.InhibitorLock = &sync.RWMutex{}
	inhibit.AlertmanagerAlerts, err = mem.NewAlerts(context.Background(), marker, alertGCInterval, nil, logger, prometheus.DefaultRegisterer)
	if err != nil {
		level.Error(logger).Log("err", err)
		return
	}

	inhibit.Inhibitor = inhibit.NewInhibitor(inhibit.AlertmanagerAlerts, marker, logger)

	// TODO: 加载报警
	err = models.LoadAlerts(inhibit.AlertmanagerAlerts)
	if err != nil {
		panic(err)
	}
	go inhibit.Inhibitor.Run()
	go initial.Timer()

	silenceOpts := alertmanagerSlience.Options{
		SnapshotFile: filepath.Join("", "silences"),
		Retention:    time.Hour * 120,
		Logger:       log.With(logger, "component", "silences"),
		Metrics:      prometheus.DefaultRegisterer,
	}

	doraemonSilence.Silences, err = alertmanagerSlience.New(silenceOpts)
	if err != nil {
		level.Error(logger).Log("err", err)
		os.Exit(1)
	}
	err = models.LoadSilences(doraemonSilence.Silences)
	if err != nil {
		logs.Error("Load silences error :%v", err)
		os.Exit(1)
	}

	stopc := make(chan struct{})
	wg := sync.WaitGroup{}

	wg.Add(1)
	go func() {
		doraemonSilence.Silences.Maintenance(15*time.Minute, filepath.Join("", "silences"), stopc, nil)
		wg.Done()
	}()

	doraemonSilence.Silencer = alertmanagerSlience.NewSilencer(doraemonSilence.Silences, initial.GetMarker(), logger)

	ticker := time.Tick(5 * time.Minute)

	go func() {
		for {
			select {
			case <-ticker:
				logs.Info("inhibitor reload")
				inhibit.Inhibitor.Stop()
				logger := promlog.New(&promlog.Config{})
				inhibit.InhibitorLock.Lock()
				inhibit.Inhibitor = inhibit.NewInhibitor(inhibit.AlertmanagerAlerts, initial.GetMarker(), logger)
				inhibit.InhibitorLock.Unlock()
				inhibit.Inhibitor.Run()
			case <-stopc:
				return
			}
		}
	}()
	beego.Run()
	wg.Wait()
}

//go:generate sh -c "echo 'package routers; import \"github.com/astaxie/beego\"; func init() {beego.BConfig.RunMode = beego.DEV}' > routers/0.go"
//go:generate sh -c "echo 'package routers; import \"os\"; func init() {os.Exit(0)}' > routers/z.go"
//go:generate go run $GOFILE
//go:generate sh -c "rm routers/0.go routers/z.go"
