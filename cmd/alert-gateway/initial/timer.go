package initial

import (
	"fmt"
	"runtime"
	"strings"
	"time"

	"github.com/astaxie/beego/orm"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"

	"doraemon/cmd/alert-gateway/common"
	"doraemon/cmd/alert-gateway/inhibit"
	"doraemon/cmd/alert-gateway/logs"
	"doraemon/cmd/alert-gateway/models"
	"doraemon/cmd/alert-gateway/silence"
)

type Record struct {
	Id              int64
	RuleId          int64
	Value           float64
	Count           int
	Summary         string
	Description     string
	Hostname        string
	ConfirmedBefore *time.Time
	FiredAt         *time.Time
	Labels          string
}

func (r Record) getLabelMap() map[string]string {
	labelMap := map[string]string{}
	if r.Labels != "" {
		for _, j := range strings.Split(r.Labels, "\v") {
			kv := strings.Split(j, "\a")
			labelMap[kv[0]] = kv[1]
		}
	}

	return labelMap
}

func (r Record) getLabelBoolMap() map[string]bool {
	labelMap := map[string]bool{}
	if r.Labels != "" {
		for _, j := range strings.Split(r.Labels, "\v") {
			kv := strings.Split(j, "\a")
			k := fmt.Sprintf("%s=%s", kv[0], kv[1])
			labelMap[k] = true
		}
	}

	return labelMap
}

type RecoverRecord struct {
	Id       int64
	RuleId   int64
	Value    float64
	Count    int
	Summary  string
	Hostname string
}

func Filter(alerts map[int64][]Record, maxCount map[int64]int) map[string][]common.Ready2Send {
	SendClass := map[string][]common.Ready2Send{
		common.AlertMethodSms:    {},
		common.AlertMethodLanxin: {},
		common.AlertMethodCall:   {},
	}
	Cache := map[int64][]common.UserGroup{}
	NewRuleCount := map[[2]int64]int64{}
	for key := range alerts {
		var usergroupList []common.UserGroup
		var planId struct {
			PlanId  int64
			Summary string
		}
		AlertsMap := map[int][]common.SingleAlert{}
		models.Ormer().Raw("SELECT plan_id,summary FROM rule WHERE id=?", key).QueryRow(&planId)
		if _, ok := Cache[planId.PlanId]; !ok {
			models.Ormer().Raw("SELECT id,start_time,end_time,start,period,reverse_polish_notation,user,`group`,duty_group,method FROM plan_receiver WHERE plan_id=?", planId.PlanId).QueryRows(&usergroupList)
			Cache[planId.PlanId] = usergroupList
		}
		for _, element := range Cache[planId.PlanId] {
			if !element.IsValid() || !element.IsOnDuty() {
				break
			}
			if maxCount[key] < element.Start {
				break
			}

			k := [2]int64{key, int64(element.Start)}
			if _, ok := common.RuleCount[k]; !ok {
				NewRuleCount[k] = 0
			} else {
				NewRuleCount[k] = 1 + common.RuleCount[k]
			}
			if NewRuleCount[k]%int64(element.Period) != 0 {
				break
			}

			// add alerts to AlertsMap
			if _, ok := AlertsMap[element.Start]; !ok {
				putToAlertMap(AlertsMap, element, alerts[key])
			}
			// forward alerts in AlertsMap to SendClass
			if len(AlertsMap[element.Start]) > 0 {
				var filteredAlerts []common.SingleAlert
				if element.ReversePolishNotation == "" {
					filteredAlerts = AlertsMap[element.Start]
				} else {
					for _, alert := range AlertsMap[element.Start] {
						if common.CalculateReversePolishNotation(alert.Labels, element.ReversePolishNotation) {
							filteredAlerts = append(filteredAlerts, alert)
						}
					}
				}
				putToSendClass(SendClass, key, element, filteredAlerts)
			}

		}
	}
	common.RuleCount = NewRuleCount
	return SendClass
}

func putToSendClass(sendClass map[string][]common.Ready2Send, ruleId int64, ug common.UserGroup, alerts []common.SingleAlert) {
	if len(alerts) <= 0 {
		return
	}

	sendClass[ug.Method] = append(sendClass[ug.Method], common.Ready2Send{
		RuleId: ruleId,
		Start:  ug.Id,
		User: models.SendAlertsFor(&common.ValidUserGroup{
			User:      ug.User,
			Group:     ug.Group,
			DutyGroup: ug.DutyGroup,
		}),
		Alerts: alerts,
	})
}

func putToAlertMap(alertMap map[int][]common.SingleAlert, ug common.UserGroup, alerts []Record) {

	alertMap[ug.Start] = []common.SingleAlert{}

	for _, alert := range alerts {
		if alert.Count >= ug.Start {
			alertMap[ug.Start] = append(alertMap[ug.Start], common.SingleAlert{
				Id:       alert.Id,
				Count:    alert.Count,
				Value:    alert.Value,
				Summary:  alert.Summary,
				Hostname: alert.Hostname,
				Labels:   alert.getLabelMap(),
			})
		}
	}
}

func Timer() {
	go func() {
		for {
			current := time.Now()
			time.Sleep(time.Duration(90-current.Second()) * time.Second)
		}
	}()
	go func() {
		for {
			current := time.Now()
			time.Sleep(time.Duration(60-current.Second()) * time.Second)

			now := time.Now().Format("2006-01-02 15:04:05")
			go func() {
				defer func() {
					if e := recover(); e != nil {
						buf := make([]byte, 16384)
						buf = buf[:runtime.Stack(buf, false)]
						logs.Panic.Error("Panic in timer:%v\n%s", e, buf)
					}
				}()
				var info []Record
				models.Ormer().Raw("UPDATE alert SET status=2 WHERE status=1 AND confirmed_before<?", now).Exec()
				o := orm.NewOrm()
				o.Begin()
				o.Raw("UPDATE alert SET count=count+1 WHERE status!=0").Exec()
				o.Raw("SELECT id,rule_id,value,count,summary,description,hostname,confirmed_before,fired_at,labels FROM alert WHERE status = ?", 2).QueryRows(&info)
				//filter alerts...
				info = toInhibit(info)
				info = toSilence(info)

				aggregation := map[int64][]Record{}
				maxCount := map[int64]int{}
				for _, i := range info {
					aggregation[i.RuleId] = append(aggregation[i.RuleId], i)
					if _, ok := maxCount[i.RuleId]; !ok {
						maxCount[i.RuleId] = i.Count
					} else {
						if i.Count > maxCount[i.RuleId] {
							maxCount[i.RuleId] = i.Count
						}
					}
				}
				common.Rw.RLock()
				ready2send := Filter(aggregation, maxCount)
				common.Rw.RUnlock()
				o.Commit()
				logs.Alertloger.Info("Alerts to send:%v", ready2send)
				Sender(ready2send, now)
				common.Lock.Lock()
				recover2send := common.Recover2Send
				common.Recover2Send = map[string]map[[2]int64]*common.Ready2Send{
					common.AlertMethodLanxin: {},
				}
				common.Lock.Unlock()
				logs.Alertloger.Info("Recoveries to send:%v", recover2send)
				RecoverSender(recover2send, now)
			}()
		}
	}()
}

func toInhibit(alerts []Record) []Record {
	var alerts2Send []Record

	inhibit.InhibitorLock.RLock()
	defer inhibit.InhibitorLock.RUnlock()
	for _, alert := range alerts {
		labelset := common.MapToLabalSet(alert.getLabelMap())

		if inhibit.Inhibitor.Mutes(labelset) {
			source, _ := GetMarker().Inhibited(labelset.Fingerprint())
			fp, err := model.ParseFingerprint(source[0])
			if err != nil {
				fmt.Printf("ParseFingerprint err:%v\n", err)
			}
			sourceAlert, err := inhibit.AlertmanagerAlerts.Get(fp)
			if err != nil {
				fmt.Printf("AlertmanagerAlerts.Get SourceAlert err:%v\n", err)
			}
			triggerTime := inhibitTriggerTime(sourceAlert, &alert)
			var inhibitLog models.InhibitLog
			inhibitLog.Id = 0
			inhibitLog.AlertId = alert.Id
			inhibitLog.Summary = alert.Summary
			inhibitLog.Labels = alert.Labels
			inhibitLog.Sources = string(sourceAlert.Annotations["alert_id"])
			inhibitLog.TriggerTime = triggerTime
			if !inhibitLog.Exists() {
				err = inhibitLog.InsertInhibitLog()
				if err != nil {
					fmt.Printf("InsertInhibitLog err:%v\n", err)
				}
			}
		} else {
			alerts2Send = append(alerts2Send, alert)
		}
	}
	return alerts2Send
}

func toSilence(alerts []Record) []Record {
	var alerts2Send []Record
	for _, alert := range alerts {
		labelset := common.MapToLabalSet(alert.getLabelMap())
		if !silence.Silencer.Mutes(labelset) {
			alerts2Send = append(alerts2Send, alert)
		} else {
			logs.Debug("Alert %v is muted by silence", alert)
		}
	}
	return alerts2Send
}

// return the inhibited alert's trigger time
// if source alert fired after target alert, return source alert's trigger time
// else return target alert's trigger time
func inhibitTriggerTime(source *types.Alert, alert *Record) *time.Time {
	timePattern := "2006-01-02 15:04:05"
	if alert.FiredAt.Sub(source.StartsAt) < 0 {
		t, err := time.ParseInLocation(timePattern, source.StartsAt.Format(timePattern), time.Local)
		if err != nil {
			logs.Error("inhibitTriggerTime ParseInLocation err:%v", err)
		}
		return &t
	} else {
		t, err := time.ParseInLocation(timePattern, alert.FiredAt.Format(timePattern), time.Local)
		if err != nil {
			logs.Error("inhibitTriggerTime ParseInLocation err:%v", err)
		}
		return &t
	}
}
