package controllers

import (
	"doraemon/cmd/alert-gateway/common"
	"doraemon/cmd/alert-gateway/logs"
	"doraemon/cmd/alert-gateway/models"
	"encoding/json"
	"strconv"

	"github.com/astaxie/beego"
)

type InhibitsController struct {
	beego.Controller
}

func (c *InhibitsController) URLMapping() {
	c.Mapping("GetInhibitLogs", c.GetInhibitLogs)
	c.Mapping("AddInhibitRule", c.AddInhibitRule)
	c.Mapping("DeleteInhibitRule", c.DeleteInhibitRule)
	c.Mapping("GetInhibitRules", c.GetInhibitRules)
	c.Mapping("UpdateInhibitRule", c.UpdateInhibitRule)
}

// @router /logs [get]
func (c *InhibitsController) GetInhibitLogs() {
	pageNo, _ := strconv.ParseInt(c.Input().Get("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.Input().Get("pagesize"), 10, 64)
	timeStart := c.Input().Get("timestart")
	timeEnd := c.Input().Get("timeend")
	if pageNo == 0 && pageSize == 0 {
		pageNo = 1
		pageSize = 20
	}
	var Receiver *models.InhibitLog
	inhibitLogs := Receiver.GetInhibitLogs(pageNo, pageSize, timeStart, timeEnd)
	c.Data["json"] = &common.Res{
		Code: 0,
		Msg:  "",
		Data: inhibitLogs,
	}
	c.ServeJSON()
}

// @router / [post]
func (c *InhibitsController) AddInhibitRule() {
	defer c.ServeJSON()
	inhibitRule := models.InhibitRule{}
	var ans common.Res
	c.Data["json"] = &ans
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &inhibitRule)
	if err != nil {
		logs.Error("Unmarshal plan error:%v", err)
		ans.Code = 1
		ans.Msg = "Unmarshal error"
		return
	}
	inhibitRule.Id = 0
	err = inhibitRule.InsertInhibitRule()
	if err != nil {
		logs.Error("InsertInhibitRule error:%v", err)
		ans.Code = 1
		ans.Msg = "InsertInhibitRule error"
		return
	}
}

// @router /:id [delete]
func (c *InhibitsController) DeleteInhibitRule() {
	var ans common.Res
	strv := c.Ctx.Input.Param(":id")
	rule_id, err := strconv.ParseInt(strv, 10, 64)
	if err != nil {
		ans.Code = 1
		ans.Msg = "获取参数错误：" + err.Error()
		c.Data["json"] = &ans
		c.ServeJSON()
		return
	}
	var inhibit *models.InhibitRule
	err = inhibit.DeleteInhibitRule(rule_id)
	if err != nil {
		ans.Code = 1
		ans.Msg = "数据库删除记录错误：" + err.Error()
	}
	c.Data["json"] = &ans
	c.ServeJSON()
}

// @router / [put]
func (c *InhibitsController) UpdateInhibitRule() {
	var ans common.Res
	c.Data["json"] = &ans
	strv := c.Ctx.Input.Param(":id")
	rule_id, err := strconv.ParseInt(strv, 10, 64)
	defer c.ServeJSON()
	if err != nil {
		ans.Code = 1
		ans.Msg = "获取参数错误：" + err.Error()
		return
	}
	inhibitRule := models.InhibitRule{}
	err = json.Unmarshal(c.Ctx.Input.RequestBody, &inhibitRule)
	if err != nil {
		logs.Error("Unmarshal plan error:%v", err)
		ans.Code = 1
		ans.Msg = "Unmarshal error"
		return
	}
	inhibitRule.Id = rule_id
	err = inhibitRule.UpdateInhibitRule()
	if err != nil {
		logs.Error("UpdateInhibitRule error:%v", err)
		ans.Code = 1
		ans.Msg = "UpdateInhibitRule error"
		return
	}
}

func (c *InhibitsController) GetInhibitRules() {
	pageNo, _ := strconv.ParseInt(c.Input().Get("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.Input().Get("pagesize"), 10, 64)
	if pageNo == 0 && pageSize == 0 {
		pageNo = 1
		pageSize = 20
	}
	var Receiver *models.InhibitRule
	inhibitRules := Receiver.GetInhibitRules(pageNo, pageSize)
	c.Data["json"] = &common.Res{
		Code: 0,
		Msg:  "",
		Data: inhibitRules,
	}
	c.ServeJSON()
}
