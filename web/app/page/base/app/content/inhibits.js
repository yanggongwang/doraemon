import React, { Component } from "react";
import {
  Form,
  Table,
  Pagination,
  Input,
  Button,
  DatePicker,
  Tag,
  Tabs,
  Popconfirm,
  message,
} from "antd";
import {
  addInhibits,
  getInhibitList,
  deleteInhibits,
  updateInhibits,
  getInhibitLogs,
} from "@apis/inhibits";
import { tableTimeWidth } from "@configs/const";
import { removeObjectUseless } from "@configs/common";
import moment from "moment";
import CreateEditInhibits from "./inhibits/create-edit-inhibits";

@Form.create({})
export default class Inhibit extends Component {
  state = {
    dataSource: [],
    page: {
      current: 1,
      total: 0,
      size: 10,
    },
    editModal: false,
    tabKey: "1",
  };
  componentDidMount() {
    this.getList();
  }
  getList(config = {}) {
    const { page, tabKey } = this.state;
    if (tabKey == "1") {
      getInhibitList(
        {},
        (res) => {
          const { total, rows } = res;
          this.setState({
            dataSource: rows.sort((a, b) => b.id - a.id),
            page: { ...page, total },
          });
        },
        { params: { page: page.current, pagesize: page.size, ...config } }
      );
    } else {
      getInhibitLogs(
        {},
        (res) => {
          const { total, rows } = res;
          this.setState({
            dataSource: rows.sort((a, b) => b.id - a.id),
            page: { ...page, total },
          });
        },
        { params: { page: page.current, pagesize: page.size, ...config } }
      );
    }
  }
  handleAdd = (e) => {
    this.setState({
      editModal: true,
    });
    this.createEditInhibits.updateValue({});
  };
  handleEdit = (text, record) => {
    this.setState({
      editModal: true,
      editData: record,
    });
    this.createEditInhibits.updateValue(record);
  };
  handleDelete = (record) => {
    const { id } = record;
    deleteInhibits(
      {},
      { id },
      (res) => {
        message.success(`删除 ${id} 成功`);
        this.getList();
      },
      (e) => {
        message.failed(`删除 ${id} 失败, ${e}`);
      }
    );
  };
  inhibitsUpdate = (inhibit) =>
    new Promise((resolve) => {
      const { id, ...data } = inhibit;
      if (id) {
        updateInhibits(data, { id }, (res) => {
          this.getList();
          this.setState({
            editModal: false,
          });
          resolve(true);
        });
        return;
      }
      addInhibits(data, (res) => {
        resolve(true);
        this.getList();
        this.setState({
          editModal: false,
        });
      });
    });
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
  tabChange = (key) => {
    this.setState(
      {
        tabKey: key,
      },
      () => {
        this.getList();
      }
    );
  };
  closeEditModal() {
    this.setState({
      editModal: false,
    });
  }
  pageChange = (page, pageSize) => {
    this.setState(
      {
        page: {
          ...this.state.page,
          current: page,
          size: pageSize,
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
  onRefRule(component) {
    this.createEditInhibits = component;
  }
  getStringFromExpressionType(type) {
    switch (type) {
      case 0:
        return "=";
        break;
      case 1:
        return "!=";
      case 2:
        return "~";
      case 4:
        return "!~";
      default:
        return "";
    }
  }
  render() {
    const { dataSource, page, editModal, editData } = this.state;
    const { getFieldDecorator } = this.props.form;
    const columns = [
      {
        title: "id",
        align: "center",
        dataIndex: "id",
        sorter: (a, b) => a.id - b.id,
      },
      {
        title: "名称",
        align: "center",
        dataIndex: "name",
      },
      {
        title: "源匹配器",
        align: "center",
        dataIndex: "source_matchers",
        render: (matchers, _record, _index) => {
          const source_rows = [];
          if (!matchers) {
            return source_rows;
          }
          for (let i = 0; i < matchers.length; i++) {
            const { label_name, expression_type, expression } = matchers[i];
            source_rows.push(
              <Tag color="cyan">
                {label_name}
                {this.getStringFromExpressionType(expression_type)}
                {expression}
              </Tag>
            );
          }
          return source_rows;
        },
      },
      {
        title: "目标匹配器",
        align: "center",
        dataIndex: "target_matchers",
        render: (matchers, _record, _index) => {
          const source_rows = [];
          if (!matchers) {
            return source_rows;
          }
          for (let i = 0; i < matchers.length; i++) {
            const { label_name, expression_type, expression } = matchers[i];
            source_rows.push(
              <Tag color="green">
                {label_name}
                {this.getStringFromExpressionType(expression_type)}
                {expression}
              </Tag>
            );
          }
          return source_rows;
        },
      },
      {
        title: "相等标签名",
        align: "center",
        dataIndex: "equal",
        render: (equal, _record, _index) => {
          const labelNames = [];
          if (!equal) {
            return labelNames;
          }
          const labels = equal.split(",");

          for (let i = 0; i < labels.length; i++) {
            if (labels[i] == "") {
              continue;
            }
            labelNames.push(<Tag color="blue">{labels[i]}</Tag>);
          }

          return labelNames;
        },
      },
      {
        title: "操作",
        align: "center",
        key: "action",
        render: (text, record, index) => (
          <span>
            <a onClick={() => this.handleEdit(text, record)}>编辑</a>
            <Popconfirm
              title="确定要删除吗?"
              onConfirm={() => this.handleDelete(record)}
              okText="Yes"
              cancelText="No"
            >
              <a href="#">删除</a>
            </Popconfirm>
          </span>
        ),
      },
    ];

    const log_columns = [
      {
        title: "报警ID",
        width: 80,
        align: "center",
        dataIndex: "alert_id",
        sorter: (a, b) => a.id - b.id,
      },
      { title: "标题", align: "center", dataIndex: "summary" },
      {
        title: "标签",
        align: "center",
        dataIndex: "labels",
        render: (labels) => {
          if (labels != undefined && labels != "") {
            labels = labels.split("\v");
            const labelTags = [];
            for (let i = 0; i < labels.length; i++) {
              let kv = labels[i].split(`\x07`);
              labelTags.push(
                <Tag color="cyan" style={{ marginTop: "5px" }}>
                  {kv[0]}: {kv[1]}
                </Tag>
              );
            }
            return labelTags;
          }
        },
      },
      {
        title: "抑制源(报警ID)",
        align: "center",
        dataIndex: "sources",
      },
      {
        title: "触发时间",
        align: "center",
        dataIndex: "trigger_time",
        width: tableTimeWidth,
        render: (triggerTime) => (
          <span>{moment(triggerTime).format("YYYY.MM.DD HH:mm:ss")}</span>
        ),
      },
    ];
    return (
      <div>
        <Tabs onChange={this.tabChange}>
          <Tabs.TabPane tab="配置" key="1">
            <div style={{ paddingTop: "10px" }}>
              <div style={{ paddingBottom: "10px" }}>
                <Button type="primary" onClick={this.handleAdd}>
                  添加
                </Button>
              </div>
              <Table
                dataSource={dataSource}
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
            <CreateEditInhibits
              onRef={(c) => this.onRefRule(c)}
              visiable={editModal}
              onClose={() => this.closeEditModal()}
              onSubmit={this.inhibitsUpdate}
              getStringFromExpressionType={this.getStringFromExpressionType}
              data={editData}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="报警抑制日志" key="2">
            <div style={{ paddingTop: "10px" }}>
              <Form layout="inline" onSubmit={this.handleSearch}>
                <Form.Item label="ID">
                  {getFieldDecorator(
                    "id",
                    {}
                  )(<Input placeholder="请输入ID" />)}
                </Form.Item>
                <Form.Item label="标题">
                  {getFieldDecorator(
                    "title",
                    {}
                  )(<Input placeholder="请输入标题" />)}
                </Form.Item>
                <Form.Item label="触发时间" style={{ marginBottom: 0 }}>
                  <Form.Item style={{ marginRight: 0 }}>
                    {getFieldDecorator(
                      "timestart",
                      {}
                    )(
                      <DatePicker
                        format="YYYY-MM-DD HH:mm:ss"
                        showTime={{
                          defaultValue: moment("00:00:00", "HH:mm:ss"),
                        }}
                        placeholder="开始时间"
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
                        showTime={{
                          defaultValue: moment("00:00:00", "HH:mm:ss"),
                        }}
                        placeholder="结束时间"
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
                columns={log_columns}
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
          </Tabs.TabPane>
        </Tabs>
      </div>
    );
  }
}
