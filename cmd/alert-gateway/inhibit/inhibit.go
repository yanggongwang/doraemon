package inhibit

import (
	"doraemon/cmd/alert-gateway/models"
	"sync"

	"github.com/go-kit/log"

	"github.com/prometheus/alertmanager/config"
	alertmanagerInhibit "github.com/prometheus/alertmanager/inhibit"
	"github.com/prometheus/alertmanager/provider"
	"github.com/prometheus/alertmanager/provider/mem"
	"github.com/prometheus/alertmanager/types"
)

var (
	Inhibitor          *alertmanagerInhibit.Inhibitor
	AlertmanagerAlerts *mem.Alerts
	InhibitorLock      *sync.RWMutex
)

func NewInhibitor(ap provider.Alerts, mk types.Marker, logger log.Logger) *alertmanagerInhibit.Inhibitor {
	rules := models.GetAllInhibitRules()
	var configRules []*config.InhibitRule
	for _, rule := range rules {
		r := rule.IntoConfigRule()
		configRules = append(configRules, r)
	}

	ih := alertmanagerInhibit.NewInhibitor(ap, configRules, mk, logger)
	return ih
}
