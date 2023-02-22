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
  addSilence,
  getSilences,
  deleteSilence,
  updateSilence,
} from "@apis/silence";
import { tableTimeWidth } from "@configs/const";
import { removeObjectUseless } from "@configs/common";
import moment from "moment";
import CreateEditSilence from "./silence/create-edit-silence";

@Form.create({})
export default class Silence extends Component {
  state = {
    dataSource: [],
    page: {
      current: 1,
      total: 0,
      size: 10,
    },
    editModal: false,
  };
  componentDidMount() {
    this.getList();
  }
  getList(config = {}) {
    const { page } = this.state;
    getSilences(
      {},
      (res) => {
        const { total, silences } = res;
        this.setState({
          dataSource: silences.sort((a, b) => b.id - a.id),
          page: { ...page, total },
        });
      },
      { params: { page: page.current, pagesize: page.size, ...config } }
    );
  }
  handleAdd = (e) => {
    this.setState({
      editModal: true,
    });
    this.createEditSilence.updateValue();
  };
  handleEdit = (text, record) => {
    this.setState({
      editModal: true,
    });
    this.createEditSilence.updateValue(record);
  };
  handleDelete = (record) => {
    const { id } = record;
    deleteSilence(
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
  silencesUpdate = (silence) =>
    new Promise((resolve) => {
      const { id, ...data } = silence;
      if (id) {
        updateSilence(data, { id }, (res) => {
          this.getList();
          this.setState({
            editModal: false,
          });
          resolve(true);
        });
        return;
      }
      addSilence(data, (res) => {
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
    this.createEditSilence = component;
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
        title: "匹配器",
        align: "center",
        dataIndex: "matchers",
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
        title: "开始时间",
        align: "center",
        dataIndex: "starts_at",
        render: (text, record, index) => {
          return moment(text).format("YYYY-MM-DD HH:mm:ss");
        },
      },
      {
        title: "结束时间",
        align: "center",
        dataIndex: "ends_at",
        render: (text, record, index) => {
          return moment(text).format("YYYY-MM-DD HH:mm:ss");
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
    return (
      <div>
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
        <CreateEditSilence
          onRef={(c) => this.onRefRule(c)}
          visiable={editModal}
          onClose={() => this.closeEditModal()}
          onSubmit={this.silencesUpdate}
          getStringFromExpressionType={this.getStringFromExpressionType}
          data={editData}
        />
      </div>
    );
  }
}
