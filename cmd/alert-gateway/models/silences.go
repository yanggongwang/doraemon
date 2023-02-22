package models

import (
	"doraemon/cmd/alert-gateway/logs"
	"time"

	doraemonSilence "doraemon/cmd/alert-gateway/silence"

	"github.com/astaxie/beego/orm"
	"github.com/pkg/errors"
	alertmanagerSilence "github.com/prometheus/alertmanager/silence"
	"github.com/prometheus/alertmanager/silence/silencepb"
)

type Silence struct {
	Id       int64             `orm:"auto" json:"id,omitempty"`
	Uuid     string            `orm:"size(255)" json:"Uuid"`
	Name     string            `orm:"size(255)" json:"name"`
	StartsAt time.Time         `orm:"type(datetime)" json:"starts_at"`
	EndsAt   time.Time         `orm:"type(datetime)" json:"ends_at"`
	Matchers []*SilenceMatcher `orm:"reverse(many)" json:"matchers"`
}

func (*Silence) TableName() string {
	return "silence"
}

type SilenceMatcher struct {
	Id             int64    `orm:"auto" json:"id,omitempty"`
	Silence        *Silence `orm:"rel(fk)" json:"silence"`
	ExpressionType int      `orm:"column(expression_type);size(255)" json:"expression_type"`
	LabelName      string   `orm:"column(label_name);size(255)" json:"label_name"`
	Expression     string   `orm:"column(expression);size(255)" json:"expression"`
}

func (*SilenceMatcher) TableName() string {
	return "silence_matcher"
}

func (silence *Silence) InsertSilence() error {
	o := Ormer()
	id, err := o.Insert(silence)
	if err != nil {
		logs.Error("Insert silence error:%v", err)
		return errors.Wrap(err, "database insert error")
	}
	silence.Id = id
	for _, matcher := range silence.Matchers {
		matcher.Silence = silence
		_, err = o.Insert(matcher)
		if err != nil {
			logs.Error("Insert matcher error:%v", err)
			return errors.Wrap(err, "database insert error")
		}
	}
	// add silence to alertmanager
	silence.addAlertmanagerSilences(doraemonSilence.Silences)

	return nil
}

func (silence *Silence) UpdateSilence() error {
	o := Ormer()

	// Delete matchers
	_, err := o.QueryTable(new(SilenceMatcher)).Filter("silence__id", silence.Id).Delete()
	if err != nil {
		logs.Error("Delete matchers error:%v", err)
		return errors.Wrap(err, "Update silence error")
	}
	// Insert new matchers
	for _, matcher := range silence.Matchers {
		matcher.Silence = silence
		_, err = o.Insert(matcher)
		if err != nil {
			logs.Error("Insert matcher error:%v", err)
			return errors.Wrap(err, "UpdateSilence(insert new matchers error)")
		}
	}
	// Update silence
	_, err = o.Update(silence, "name", "starts_at", "ends_at")
	if err != nil {
		logs.Error("Update silence error:%v", err)
		return errors.Wrap(err, "Update silence error")
	}
	// update silence to alertmanager
	err = silence.updateAlertmanagerSilences(doraemonSilence.Silences)
	if err != nil {
		logs.Error("Update silence to alertmanager error:%v", err)
		return errors.Wrap(err, "Update silence error")
	}
	return nil
}

func DeleteSilence(id int64) error {
	o := orm.NewOrm()
	err := o.Begin()
	// If there is an error, rollback and return error
	defer func() {
		if err != nil {
			err = o.Rollback()
			if err != nil {
				logs.Error("Rollback transaction error:%v", err)
			}
		}
	}()

	if err != nil {
		logs.Error("Begin transaction error:%v", err)
		return errors.Wrap(err, "database delete error")
	}

	// Delete matchers
	_, err = o.QueryTable(new(SilenceMatcher)).Filter("silence__id", id).Delete()
	if err != nil {
		logs.Error("Delete matchers error:%v", err)
		return errors.Wrap(err, "database delete error")
	}

	// Expire silence from alertmanager
	var sil Silence
	_, err = o.QueryTable(new(Silence)).Filter("id", id).All(&sil)
	if err != nil {
		logs.Error("Get silence error:%v", err)
		return errors.Wrap(err, "database delete error")
	}
	err = doraemonSilence.Silences.Expire(sil.Uuid)
	if err != nil {
		logs.Warning("Expire silence error:%v", err)
	}

	// Delete InhibitRule
	if _, err := o.Delete(&sil); err != nil {
		return errors.Wrap(err, "database delete error")
	}
	err = o.Commit()
	if err != nil {
		logs.Error("Commit transaction error:%v", err)
		return errors.Wrap(err, "database delete error")
	}
	return errors.Wrap(nil, "success")
}

type ShowSilences struct {
	Silences []*Silence `json:"silences"`
	Total    int64      `json:"total"`
}

func (silence *Silence) GetSilences(pageNo int64, pageSize int64) ShowSilences {
	var silences []*Silence
	var showSilences ShowSilences
	qs := Ormer().QueryTable(new(Silence))
	count, err := qs.Count()
	if err != nil {
		logs.Error("Get silences count error: %v", err)
		return showSilences
	}
	showSilences.Total = count

	qs.Limit(pageSize).Offset((pageNo - 1) * pageSize).All(&silences)

	for _, silence := range silences {
		var matchers []*SilenceMatcher
		_, err = Ormer().QueryTable(new(SilenceMatcher)).Filter("silence__id", silence.Id).All(&matchers)
		if err != nil {
			logs.Error("Query silence matchers error: %v", err)
			return showSilences
		}
		silence.Matchers = matchers
		showSilences.Silences = append(showSilences.Silences, silence)
	}

	return showSilences
}

// Load alertmanager silence rule from doraemon silences
func LoadSilences(silences *alertmanagerSilence.Silences) error {
	var doraemonSilences []*Silence
	now := time.Now()

	qs := Ormer().QueryTable(new(Silence)).Filter("endsat__gt", now)
	qs.All(&doraemonSilences)

	for _, silence := range doraemonSilences {
		err := silence.addAlertmanagerSilences(silences)
		if err != nil {
			return err
		}
	}
	return nil
}

func (sil *Silence) addAlertmanagerSilences(silences *alertmanagerSilence.Silences) error {
	var matchers []*SilenceMatcher
	_, err := Ormer().QueryTable(new(SilenceMatcher)).Filter("silence__id", sil.Id).All(&matchers)
	if err != nil {
		return err
	}

	uid, err := silences.Set(&silencepb.Silence{
		Matchers:  Matchers2PbMatchers(matchers),
		StartsAt:  sil.StartsAt,
		EndsAt:    sil.EndsAt,
		CreatedBy: "",
	})
	if err != nil {
		return err
	}
	sil.Uuid = uid
	_, err = Ormer().Update(sil, "Uuid")
	if err != nil {
		return err
	}
	return nil
}

func (sil *Silence) updateAlertmanagerSilences(silences *alertmanagerSilence.Silences) error {
	var matchers []*SilenceMatcher
	var usil Silence
	if sil.Uuid == "" {
		err := Ormer().QueryTable(new(Silence)).Filter("id", sil.Id).One(&usil, "Uuid")
		if err != nil {
			return err
		}
	}

	_, err := Ormer().QueryTable(new(SilenceMatcher)).Filter("silence__id", sil.Id).All(&matchers)
	if err != nil {
		return err
	}

	_, err = silences.Set(&silencepb.Silence{
		Id:        usil.Uuid,
		Matchers:  Matchers2PbMatchers(matchers),
		StartsAt:  sil.StartsAt,
		EndsAt:    sil.EndsAt,
		CreatedBy: "",
	})
	if err != nil {
		return err
	}
	return nil
}

func Matcher2PbMatcher(matcher *SilenceMatcher) *silencepb.Matcher {
	return &silencepb.Matcher{
		Type:    silencepb.Matcher_Type(matcher.ExpressionType),
		Name:    matcher.LabelName,
		Pattern: matcher.Expression,
	}
}

func Matchers2PbMatchers(matchers []*SilenceMatcher) []*silencepb.Matcher {
	var pbmatchers []*silencepb.Matcher

	for _, matcher := range matchers {
		pbmatchers = append(pbmatchers, Matcher2PbMatcher(matcher))
	}
	return pbmatchers
}
