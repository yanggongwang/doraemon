// @APIVersion 1.0.0
// @Title beego Test API
// @Description beego has a very cool tools to autogenerate documents for your API
// @Contact astaxie@gmail.com
// @TermsOfServiceUrl http://beego.me/
// @License Apache 2.0
// @LicenseUrl http://www.apache.org/licenses/LICENSE-2.0.html
package routers

import (
	//	"strconv"
	//	"time"

	"strings"

	"github.com/astaxie/beego"
	"github.com/astaxie/beego/context"
	"github.com/astaxie/beego/plugins/cors"

	"doraemon/cmd/alert-gateway/common"
	"doraemon/cmd/alert-gateway/controllers"
)

var FilterUser = func(ctx *context.Context) {
	req := ctx.Request
	requestURI := req.RequestURI
	method := req.Method

	requestPath := strings.Split(requestURI, "?")[0]
	token := beego.AppConfig.String("Token")

	if ctx.Input.Header("Token") == token {
		if method == "GET" && (strings.HasPrefix(requestPath, "/api/v1/rules") || strings.HasPrefix(requestPath, "/api/v1/proms")) {
			return
		} else if method == "POST" && (strings.HasPrefix(requestPath, "/api/v1/alerts") || strings.HasPrefix(requestPath, "/api/v1/sliences")) {
			return
		}
	}

	if requestPath == "/api/v1/logout" {
		return
	}
	username, _ := ctx.Input.Session("username").(string)
	if username == "" && !strings.HasPrefix(requestPath, "/api/v1/login") {
		_ = ctx.Output.JSON(common.Res{Code: -1, Msg: "Unauthorized"}, false, false)
	}
}

func init() {
	beego.InsertFilter("*", beego.BeforeRouter, cors.Allow(&cors.Options{
		//AllowAllOrigins: true,
		AllowOrigins:     []string{"http://10.*.*.*:*", "http://localhost:*", "http://127.0.0.1:*", "http://172.*.*.*:*", "http://192.*.*.*:*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*", "content-time"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	beego.InsertFilter("/api/v1/*", beego.BeforeRouter, FilterUser)

	ns := beego.NewNamespace("/api/v1",
		beego.NSNamespace("/login",
			beego.NSInclude(
				&controllers.LoginController{},
			),
		),
		beego.NSNamespace("/logout",
			beego.NSInclude(
				&controllers.LogoutController{},
			),
		),
		beego.NSNamespace("/users",
			beego.NSInclude(
				&controllers.UserController{},
			),
		),
		beego.NSNamespace("/rules",
			beego.NSInclude(
				&controllers.RuleController{},
			),
		),
		beego.NSNamespace("/alerts",
			beego.NSInclude(
				&controllers.AlertController{},
			),
		),
		beego.NSNamespace("/plans",
			beego.NSInclude(
				&controllers.PlanController{},
			),
		),
		beego.NSNamespace("/receivers",
			beego.NSInclude(
				&controllers.ReceiverController{},
			),
		),
		beego.NSNamespace("/groups",
			beego.NSInclude(
				&controllers.GroupController{},
			),
		),
		beego.NSNamespace("/proms",
			beego.NSInclude(
				&controllers.PromController{},
			),
		),
		beego.NSNamespace("/manages",
			beego.NSInclude(
				&controllers.ManageController{},
			),
		),
		beego.NSNamespace("/configs",
			beego.NSInclude(
				&controllers.ConfigController{},
			),
		),
		beego.NSNamespace("/inhibits",
			beego.NSInclude(
				&controllers.InhibitsController{},
			),
		),
		beego.NSNamespace("/sliences",
			beego.NSInclude(
				&controllers.SilenceController{},
			),
		),
	)
	beego.AddNamespace(ns)
}
