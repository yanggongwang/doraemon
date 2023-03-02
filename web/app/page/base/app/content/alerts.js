import React, { Component } from "react";
import {
  Form,
  Table,
  Pagination,
  Input,
  Button,
  DatePicker,
  Tag,
  Select,
} from "antd";
import { getAlerts } from "@apis/alerts";
import { tableTimeWidth } from "@configs/const";
import { removeObjectUseless } from "@configs/common";
import { Link } from "react-router-dom";
import moment from "moment";

const { Option } = Select;

@Form.create({})
export default class Strategy extends Component {
  state = {
    dataSource: [],
    page: {
      current: 1,
      total: 0,
      size: 10,
    },
    labalWidth: 100,
  };
  componentDidMount() {
    this.getList();
  }
  getList(config = {}) {
    const { page } = this.state;
    getAlerts(
      {},
      (res) => {
        const { total, alerts } = res;
        const labalWidth = Math.max(
          (this.calcLabelWidth(alerts) + 1) * 6.2 + 16,
          80
        );
        this.setState({
          dataSource: alerts.sort((a, b) => b.id - a.id),
          page: { ...page, total },
          labalWidth,
        });
      },
      { params: { page: page.current, pagesize: page.size, ...config } }
    );
  }
  calcLabelWidth(data) {
    let maxLength = 0;
    data.forEach((item) => {
      const { labels } = item;
      Object.keys(labels || {}).forEach((key) => {
        maxLength = Math.max(maxLength, key.length + labels[key].length);
      });
    });
    return maxLength;
  }
  pageChange = (page, pageSize) => {
    this.setState(
      {
        page: {
          ...this.state.page,
          current: page,
        },
      },
      () => {
        this.handleSearch();
      }
    );
  };
  formatSearch(values) {
    const { ...value } = values;
    Object.keys(value).forEach((key) => {
      switch (key) {
        case "timestart":
        case "timeend":
          if (value[key]) {
            value[key] = moment(value[key]).format("YYYY-MM-DD HH:mm:ss");
            break;
          }
          removeObjectUseless(value, key);
          break;
        case "summary":
          removeObjectUseless(value, key);
          break;
        case "status":
          if (value[key] === -1) {
            delete value[key];
          }
          break;
        default:
          break;
      }
    });
    return value;
  }
  handleSearch = (e) => {
    e && e.preventDefault();
    this.props.form.validateFields((err, values) => {
      if (!err) {
        this.getList(this.formatSearch(values));
      }
    });
  };
  render() {
    const { dataSource, page, labalWidth } = this.state;
    const { getFieldDecorator } = this.props.form;
    const columns = [
      {
        title: "id",
        align: "center",
        dataIndex: "id",
        sorter: (a, b) => a.id - b.id,
        width: 80,
      },
      {
        title: "Rule ID",
        align: "center",
        dataIndex: "rule_id",
        render: (ruleId) => <Link to={`/rules?id=${ruleId}`}>{ruleId}</Link>,
        width: 80,
      },
      { title: "报警值", align: "center", dataIndex: "value", width: 80 },
      {
        title: "当前状态",
        align: "center",
        dataIndex: "status",
        width: 90,
        render: (status) => {
          let stTag;
          if (status === 2) {
            stTag = <Tag color="gold">报警</Tag>;
          } else if (status === 0) {
            stTag = <Tag color="green">恢复</Tag>;
          } else {
            stTag = <Tag color="#108ee9">已确认</Tag>;
          }
          return <span>{stTag}</span>;
        },
      },
      {
        title: "异常分钟数",
        align: "center",
        dataIndex: "count",
        width: 80,
        render: (count) => <span>{count + 1}</span>,
      },
      {
        title: "标题",
        align: "center",
        dataIndex: "labels.alertname",
        width: 100,
        render: (alertname) => <Tag color="#108ee9">{alertname}</Tag>,
      },
      {
        title: "开始时间",
        align: "center",
        dataIndex: "fired_at",
        width: tableTimeWidth,
        render: (firedAt) => (
          <span>
            <Tag color="#f50">
              {firedAt === "0001-01-01T00:00:00Z"
                ? "--"
                : moment(firedAt).format("YYYY.MM.DD HH:mm:ss")}
            </Tag>
          </span>
        ),
      },
      {
        title: "结束时间",
        align: "center",
        dataIndex: "resolved_at",
        width: tableTimeWidth,
        render: (resolvedAt) => (
          <span>
            <Tag color="#f50" style={{ margin: "10px" }}>
              {resolvedAt === "0001-01-01T00:00:00Z"
                ? "持续中"
                : moment(resolvedAt).format("YYYY.MM.DD HH:mm:ss")}
            </Tag>
          </span>
        ),
      },
    ];

    const expandedRowRender = (record) => {
      const { labels } = record;
      const labelList = Object.keys(labels || {}).map((key) => {
        return (
          <Tag color="blue" key={key}>
            {key}={labels[key]}
          </Tag>
        );
      });

      let data = [];
      data.push({
        name: "标签",
        value: labelList,
      });
      data.push({
        name: "概述",
        value: record.summary,
      });
      data.push({
        name: "描述",
        value: record.description,
      });
      if (record.status === 1) {
        data.push({
          name: "确认人",
          value: record.confirmed_by,
        });
        data.push({
          name: "确认时间",
          value: record.confirmed_at,
        });
        data.push({
          name: "确认截止时间",
          value: record.confirmed_before,
        });
      }

      let columns = [
        {
          dataIndex: "name",
          width: "10%",
        },
        {
          dataIndex: "value",
        },
      ];

      return (
        <Table
          columns={columns}
          dataSource={data}
          pagination={false}
          bordered={true}
          showHeader={false}
          rowKey="name"
        />
      );
    };
    return (
      <div>
        <Form layout="inline" onSubmit={this.handleSearch}>
          <Form.Item label="标题">
            {getFieldDecorator(
              "summary",
              {}
            )(<Input placeholder="请输入标题" />)}
          </Form.Item>
          <Form.Item label="状态">
            {getFieldDecorator("status", {
              initialValue: -1,
            })(
              <Select>
                <Option value={-1}>所有</Option>
                <Option value={0}>恢复</Option>
                <Option value={1}>已确认</Option>
                <Option value={2}>报警</Option>
              </Select>
            )}
          </Form.Item>
          <Form.Item label="报警时间" style={{ marginBottom: 0 }}>
            <Form.Item style={{ marginRight: 0 }}>
              {getFieldDecorator(
                "timestart",
                {}
              )(
                <DatePicker
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime={{ defaultValue: moment("00:00:00", "HH:mm:ss") }}
                  placeholder="报警开始时间"
                />
              )}
            </Form.Item>
            <span
              style={{
                width: "24px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ~
            </span>
            <Form.Item style={{ marginBottom: 0 }}>
              {getFieldDecorator(
                "timeend",
                {}
              )(
                <DatePicker
                  format="YYYY-MM-DD HH:mm:ss"
                  showTime={{ defaultValue: moment("00:00:00", "HH:mm:ss") }}
                  placeholder="报警结束时间"
                />
              )}
            </Form.Item>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              查询
            </Button>
          </Form.Item>
        </Form>
        <Table
          dataSource={dataSource}
          expandedRowRender={expandedRowRender}
          columns={columns}
          pagination={false}
          rowKey="id"
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "15px",
          }}
        >
          <Pagination
            onChange={this.pageChange}
            current={page.current}
            pageSize={page.size}
            total={page.total}
          />
        </div>
      </div>
    );
  }
}
