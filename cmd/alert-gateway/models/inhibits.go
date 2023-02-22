package models

import (
	"strings"

	"github.com/astaxie/beego/orm"
	"github.com/pkg/errors"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"doraemon/cmd/alert-gateway/logs"
)

type SourceMatcher struct {
	Id          int64        `orm:"column(id);auto" json:"id,omitempty"`
	InhibitRule *InhibitRule `orm:"column(inhibit_rule);rel(fk)" json:"inhibit_rule,omitempty"`
	// MatchEqual = 0
	// MatchNotEqual = 1
	// MatchRegexp = 2
	// MatchNotRegexp = 3
	ExpressionType int    `orm:"column(expression_type);size(255)" json:"expression_type"`
	LabelName      string `orm:"column(label_name);size(255)" json:"label_name"`
	Expression     string `orm:"column(expression);size(255)" json:"expression"`
}

func (*SourceMatcher) TableName() string {
	return "inhibit_rule_source_matcher"
}

type TargetMatcher struct {
	Id          int64        `orm:"column(id);auto" json:"id,omitempty"`
	InhibitRule *InhibitRule `orm:"column(inhibit_rule);rel(fk)" json:"inhibit_rule,omitempty"`
	// MatchEqual = 0
	// MatchNotEqual = 1
	// MatchRegexp = 2
	// MatchNotRegexp = 3
	ExpressionType int    `orm:"column(expression_type);size(255)" json:"expression_type"`
	LabelName      string `orm:"column(label_name);size(255)" json:"label_name"`
	Expression     string `orm:"column(expression);size(255)" json:"expression"`
}

func (*TargetMatcher) TableName() string {
	return "inhibit_rule_target_matcher"
}

type InhibitRule struct {
	Id             int64            `orm:"column(id);auto" json:"id,omitempty"`
	Name           string           `orm:"column(name);size(255)" json:"name"`
	SourceMatchers []*SourceMatcher `orm:"reverse(many)" json:"source_matchers"`
	TargetMatchers []*TargetMatcher `orm:"reverse(many)" json:"target_matchers"`
	Equal          string           `orm:"column(equal);size(255)" json:"equal"`
}

func (*InhibitRule) TableName() string {
	return "inhibit_rule"
}

// InsertInhibitRule insert inhibitRule and sourceMatchers and targetMatchers
func (inhibitRule *InhibitRule) InsertInhibitRule() error {
	o := orm.NewOrm()
	id, err := o.Insert(inhibitRule)
	if err != nil {
		logs.Error("Insert inhibitRule error:%v", err)
		return errors.Wrap(err, "database insert error")
	}
	inhibitRule.Id = id

	for _, sourceMatcher := range inhibitRule.SourceMatchers {
		sourceMatcher.InhibitRule = inhibitRule
		_, err = o.Insert(sourceMatcher)
		if err != nil {
			logs.Error("Insert sourceMatcher error:%v", err)
			return errors.Wrap(err, "database insert error")
		}
	}

	for _, targetMatcher := range inhibitRule.TargetMatchers {
		targetMatcher.InhibitRule = inhibitRule
		_, err = o.Insert(targetMatcher)
		if err != nil {
			logs.Error("Insert targetMatcher error:%v", err)
			return errors.Wrap(err, "database insert error")
		}
	}

	return nil
}

// Delete InhibitRule, Use Transaction, First delete matchers and targetMatchers, then delete InhibitRule
func (inhibitRule *InhibitRule) DeleteInhibitRule(id int64) error {
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
	_, err = o.QueryTable(new(SourceMatcher)).Filter("inhibit_rule__id", id).Delete()
	if err != nil {
		logs.Error("Delete matchers error:%v", err)
		return errors.Wrap(err, "database delete error")
	}
	_, err = o.QueryTable(new(TargetMatcher)).Filter("inhibit_rule__id", id).Delete()
	if err != nil {
		logs.Error("Delete targetMatchers error:%v", err)
		return errors.Wrap(err, "database delete error")
	}

	// Delete InhibitRule
	if _, err := o.Delete(&InhibitRule{Id: id}); err != nil {
		return errors.Wrap(err, "database delete error")
	}
	err = o.Commit()
	if err != nil {
		logs.Error("Commit transaction error:%v", err)
		return errors.Wrap(err, "database delete error")
	}
	return errors.Wrap(nil, "success")
}

// Get All InhibitRules
func GetAllInhibitRules() []InhibitRule {
	var inhibitRules []InhibitRule
	o := Ormer()
	_, err := o.QueryTable(new(InhibitRule)).All(&inhibitRules)
	if err != nil {
		logs.Error("Get all inhibitRules error:%v", err)
		return nil
	}
	var res []InhibitRule
	for _, rule := range inhibitRules {
		var sourceMatcher []*SourceMatcher
		var targetMatcher []*TargetMatcher
		_, err = o.QueryTable(new(SourceMatcher)).Filter("inhibit_rule__id", rule.Id).All(&sourceMatcher)
		if err != nil {
			logs.Error("Get matchers error:%v", err)
			return nil
		}
		_, err = o.QueryTable(new(TargetMatcher)).Filter("inhibit_rule__id", rule.Id).All(&targetMatcher)
		if err != nil {
			logs.Error("Get matchers error:%v", err)
			return nil
		}
		rule.SourceMatchers = sourceMatcher
		rule.TargetMatchers = targetMatcher
		res = append(res, rule)
	}
	return res
}

type ShowInhibitRules struct {
	InhibitRules []*InhibitRuleResp `json:"rows"`
	Total        int64              `json:"total"`
}

type MatcherResp struct {
	Id             int64  `orm:"column(id);auto" json:"id"`
	ExpressionType int    `orm:"column(expression_type);size(255)" json:"expression_type"`
	LabelName      string `orm:"column(label_name);size(255)" json:"label_name"`
	Expression     string `orm:"column(expression);size(255)" json:"expression"`
}

type InhibitRuleResp struct {
	Id             int64          `orm:"column(id);auto" json:"id"`
	Name           string         `orm:"column(name);size(255)" json:"name"`
	SourceMatchers []*MatcherResp `orm:"reverse(many)" json:"source_matchers"`
	TargetMatchers []*MatcherResp `orm:"reverse(many)" json:"target_matchers"`
	Equal          string         `orm:"column(equal);size(255)" json:"equal"`
}

func (sourceMatcher *SourceMatcher) ToResp() *MatcherResp {
	return &MatcherResp{
		Id:             sourceMatcher.Id,
		ExpressionType: sourceMatcher.ExpressionType,
		LabelName:      sourceMatcher.LabelName,
		Expression:     sourceMatcher.Expression,
	}
}

func (targetMatcher *TargetMatcher) ToResp() *MatcherResp {
	return &MatcherResp{
		Id:             targetMatcher.Id,
		ExpressionType: targetMatcher.ExpressionType,
		LabelName:      targetMatcher.LabelName,
		Expression:     targetMatcher.Expression,
	}
}

func (inhibitRule *InhibitRule) ToResp() *InhibitRuleResp {
	var sourceMatchers []*MatcherResp
	var targetMatchers []*MatcherResp
	for _, sourceMatcher := range inhibitRule.SourceMatchers {
		sourceMatchers = append(sourceMatchers, sourceMatcher.ToResp())
	}
	for _, targetMatcher := range inhibitRule.TargetMatchers {
		targetMatchers = append(targetMatchers, targetMatcher.ToResp())
	}
	return &InhibitRuleResp{
		Id:             inhibitRule.Id,
		Name:           inhibitRule.Name,
		SourceMatchers: sourceMatchers,
		TargetMatchers: targetMatchers,
		Equal:          inhibitRule.Equal,
	}
}

func (inhibitRule *InhibitRule) GetInhibitRules(pageNo int64, pageSize int64) ShowInhibitRules {
	var showInhibitRules ShowInhibitRules
	var inhibitRules []*InhibitRule
	qs := Ormer().QueryTable(new(InhibitRule))

	// 处理完查询条件之后
	showInhibitRules.Total, _ = qs.Count()
	qs.Limit(pageSize).Offset((pageNo - 1) * pageSize).All(&inhibitRules)

	for _, rule := range inhibitRules {
		var sourceMatchers []*SourceMatcher
		var targetMatchers []*TargetMatcher
		_, err := Ormer().QueryTable(new(SourceMatcher)).Filter("inhibit_rule__id", rule.Id).All(&sourceMatchers)
		if err != nil {
			logs.Error("Get matchers error:%v", err)
			return showInhibitRules
		}
		_, err = Ormer().QueryTable(new(TargetMatcher)).Filter("inhibit_rule__id", rule.Id).All(&targetMatchers)
		if err != nil {
			logs.Error("Get matchers error:%v", err)
			return showInhibitRules
		}

		rule.SourceMatchers = sourceMatchers
		rule.TargetMatchers = targetMatchers

		showInhibitRules.InhibitRules = append(showInhibitRules.InhibitRules, rule.ToResp())
	}

	return showInhibitRules
}

// update inhibitRule
// 1. delete old matchers
// 2. insert new matchers
// 3. update inhibitRule fields
func (inhibitRule *InhibitRule) UpdateInhibitRule() error {
	o := Ormer()
	_, err := o.QueryTable(new(SourceMatcher)).Filter("inhibit_rule__id", inhibitRule.Id).Delete()
	if err != nil {
		logs.Error("Delete old sourceMatchers error:%v", err)
		return err
	}
	_, err = o.QueryTable(new(TargetMatcher)).Filter("inhibit_rule__id", inhibitRule.Id).Delete()
	if err != nil {
		logs.Error("Delete old targetMatchers error:%v", err)
		return err
	}

	for _, sourceMatcher := range inhibitRule.SourceMatchers {
		sourceMatcher.InhibitRule = inhibitRule
		_, err = o.Insert(sourceMatcher)
		if err != nil {
			logs.Error("Insert sourceMatcher error:%v", err)
			return err
		}
	}
	for _, targetMatcher := range inhibitRule.TargetMatchers {
		targetMatcher.InhibitRule = inhibitRule
		_, err = o.Insert(targetMatcher)
		if err != nil {
			logs.Error("Insert targetMatcher error:%v", err)
			return err
		}
	}

	_, err = o.Update(inhibitRule)
	if err != nil {
		logs.Error("Update inhibitRule error:%v", err)
		return err
	}
	return nil
}

func (r *InhibitRule) IntoConfigRule() *config.InhibitRule {
	var (
		sourcem labels.Matchers
		targetm labels.Matchers
	)

	for _, matcher := range r.SourceMatchers {
		labelMatcher, err := labels.NewMatcher(labels.MatchType(matcher.ExpressionType), matcher.LabelName, matcher.Expression)
		if err != nil {
			panic(err)
		}
		sourcem = append(sourcem, labelMatcher)
	}
	for _, matcher := range r.TargetMatchers {
		labelMatcher, err := labels.NewMatcher(labels.MatchType(matcher.ExpressionType), matcher.LabelName, matcher.Expression)
		if err != nil {
			panic(err)
		}
		targetm = append(targetm, labelMatcher)
	}
	equal := []model.LabelName{}
	for _, strv := range strings.Split(r.Equal, ",") {
		if strv == "" {
			continue
		}
		ln := model.LabelName(strv)
		equal = append(equal, ln)
	}

	return &config.InhibitRule{
		SourceMatchers: config.Matchers(sourcem),
		TargetMatchers: config.Matchers(targetm),
		Equal:          equal,
	}
}
