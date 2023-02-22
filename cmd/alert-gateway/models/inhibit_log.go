package models

import (
	"time"

	"github.com/astaxie/beego/orm"
	"github.com/pkg/errors"

	"doraemon/cmd/alert-gateway/logs"
)

type InhibitLog struct {
	Id          int64      `orm:"column(id);auto" json:"id,omitempty"`
	AlertId     int64      `orm:"column(alert_id);" json:"alert_id"`
	Summary     string     `orm:"column(summary);size(1023)" json:"summary"`
	Labels      string     `orm:"column(labels);size(1023)" json:"labels"`
	Sources     string     `orm:"column(sources);size(127)" json:"sources"`
	TriggerTime *time.Time `orm:"type(datetime)" json:"trigger_time"`
}

type ShowInhibitLogs struct {
	InhibitLogs []InhibitLog `json:"rows"`
	Total       int64        `json:"total"`
}

func (*InhibitLog) TableName() string {
	return "inhibit_logs"
}

func (inhibitLog *InhibitLog) InsertInhibitLog() error {
	o := Ormer()
	_, err := o.Insert(inhibitLog)
	if err != nil {
		logs.Error("Insert InhibitLog error:%v", err)
		return errors.Wrap(err, "database insert error")
	}
	return errors.Wrap(err, "database insert error")
}

func (inhibitLog *InhibitLog) Exists() bool {
	var id int64
	err := Ormer().Raw("select id from inhibit_logs where alert_id = ? and sources = ? and trigger_time = ?", inhibitLog.AlertId, inhibitLog.Sources, inhibitLog.TriggerTime).QueryRow(&id)
	logs.Debug("InhibitLog.Exists(alert_id, sources, trigger_time): %v, %v, %v", inhibitLog.AlertId, inhibitLog.Sources, inhibitLog.TriggerTime)
	if err != nil {
		if err != orm.ErrNoRows {
			logs.Error("InhibitLog Exists error:%v", err)
		}
		return false
	}
	return true
}

func (*InhibitLog) Get(id int64) InhibitLog {
	var inhibitLog InhibitLog
	Ormer().QueryTable(new(InhibitLog)).Filter("id__eq", id).One(&inhibitLog)
	return inhibitLog
}

func (*InhibitLog) GetInhibitLogs(pageNo int64, pageSize int64, timeStart string, timeEnd string) ShowInhibitLogs {
	var showInhibitLogs ShowInhibitLogs
	qs := Ormer().QueryTable(new(InhibitLog))
	if timeStart != "" {
		qs = qs.Filter("fired_at__gte", timeStart)
	}
	if timeEnd != "" {
		qs = qs.Filter("fired_at__lte", timeEnd)
	}

	// 处理完查询条件之后
	showInhibitLogs.Total, _ = qs.Count()
	qs.OrderBy("-id").Limit(pageSize).Offset((pageNo - 1) * pageSize).All(&showInhibitLogs.InhibitLogs)

	return showInhibitLogs
}
