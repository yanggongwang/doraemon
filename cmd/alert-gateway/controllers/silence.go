package controllers

import (
	"doraemon/cmd/alert-gateway/common"
	"doraemon/cmd/alert-gateway/logs"
	"doraemon/cmd/alert-gateway/models"
	"encoding/json"
	"strconv"

	"github.com/astaxie/beego"
)

type SilenceController struct {
	beego.Controller
}

func (c *SilenceController) URLMapping() {
	c.Mapping("AddSilence", c.AddSilence)
	c.Mapping("GetSilence", c.GetSilence)
	c.Mapping("GetSilences", c.GetSilences)
	c.Mapping("DeleteSilence", c.DeleteSilence)
	c.Mapping("UpdateSilence", c.UpdateSilence)
}

// @router / [post]
func (c *SilenceController) AddSilence() {
	var data models.Silence
	defer c.ServeJSON()
	err := json.Unmarshal(c.Ctx.Input.RequestBody, &data)
	if err != nil {
		logs.Error("Unmarshal silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Unmarshal silence error",
		}
		return
	}

	if err := data.InsertSilence(); err != nil {
		logs.Error("Insert silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Insert silence error",
		}
		return
	}

	c.Data["json"] = &common.Res{
		Code: 0,
		Msg:  "success",
	}
}

// @router /:id [get]
func (c *SilenceController) GetSilence() {
}

// @router / [get]
func (c *SilenceController) GetSilences() {
	pageNo, _ := strconv.ParseInt(c.Input().Get("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.Input().Get("pagesize"), 10, 64)
	if pageNo == 0 && pageSize == 0 {
		pageNo = 1
		pageSize = 20
	}
	var Receiver *models.Silence
	silences := Receiver.GetSilences(pageNo, pageSize)
	c.Data["json"] = &common.Res{
		Code: 0,
		Msg:  "",
		Data: silences,
	}
	c.ServeJSON()
}

// @router /:id [delete]
func (c *SilenceController) DeleteSilence() {
	strv := c.Ctx.Input.Param(":id")
	id, err := strconv.ParseInt(strv, 10, 64)
	defer c.ServeJSON()
	if err != nil {
		logs.Error("Delete silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Delete silence error",
		}
		return
	}
	if err := models.DeleteSilence(id); err != nil {
		logs.Error("Delete silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Delete silence error",
		}
		return
	}
	c.Data["json"] = &common.Res{
		Code: 0,
		Msg:  "success",
	}
}

// @router /:id [put]
func (c *SilenceController) UpdateSilence() {
	strv := c.Ctx.Input.Param(":id")
	id, err := strconv.ParseInt(strv, 10, 64)
	if err != nil {
		logs.Error("Update silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Update silence error",
		}
		c.ServeJSON()
		return
	}
	var data *models.Silence
	err = json.Unmarshal(c.Ctx.Input.RequestBody, &data)
	if err != nil {
		logs.Error("Unmarshal silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Unmarshal silence error",
		}
		c.ServeJSON()
		return
	}
	data.Id = id
	if err := data.UpdateSilence(); err != nil {
		logs.Error("Update silence error:%v", err)
		c.Data["json"] = &common.Res{
			Code: 1,
			Msg:  "Update silence error",
		}
		c.ServeJSON()
		return
	}
	c.Data["json"] = &common.Res{
		Code: 0,
		Msg:  "success",
	}
	c.ServeJSON()
}
