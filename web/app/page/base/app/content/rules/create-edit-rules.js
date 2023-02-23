import React, { Component } from "react";
import { Modal, message, Form, Input, Select, Icon, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { formItemLayout } from "@configs/const";
import { promethus, strategy } from "@actions/common";
import { connect } from "react-redux";

const { Option } = Select;

let formId = 0;

const formItemLayoutWithOutLabel = {
  wrapperCol: {
    xs: { span: 24, offset: 0 },
    sm: { span: 20, offset: 7 },
  },
};

@connect(
  (state, props) => ({
    promethusState: state.promethus.loaded,
    promethusData: state.promethus.data,
    strategyState: state.strategy.loaded,
    strategyData: state.strategy.data,
  }),
  (dispatch) => ({
    promethusAction: () => dispatch(promethus()),
    strategyAction: () => dispatch(strategy()),
  })
)
@Form.create({})
export default class CreateEditRules extends Component {
  constructor(props) {
    super(props);
    const { promethusState, strategyState, promethusAction, strategyAction } =
      props;
    if (!promethusState) {
      promethusAction();
    }
    if (!strategyState) {
      strategyAction();
    }
  }
  state = {
    id: 0,
  };
  componentDidMount() {
    this.props.onRef(this);
    formId = 0;
  }
  updateValue(value) {
    const { form } = this.props;
    form.resetFields();
    this.setState({
      id: value ? value.id : 0,
      data: value,
    });

    if (value) {
      const { labels } = value;
      const labelArray = [];
      let i = 0;
      for (let key in labels) {
        labelArray.push(`${key}=${labels[key]}`);
        form.getFieldDecorator(`labels[${i++}]`, { initialValue: "" });
      }
      form.setFieldsValue({
        labels: labelArray,
        alert: value.alert,
        expr: value.expr,
        description: value.description,
        summary: value.summary,
        prom_id: value.prom_id,
        plan_id: value.plan_id,
        for: value.for,
        value: value.value,
      });
    }
  }

  handleOk = (e) => {
    this.props.form.validateFields(async (err, values) => {
      if (!err) {
        const { id } = this.state;
        const { keys, labels } = values;
        const labelMap = {};
        for (let i = 0; i < keys.length; i++) {
          const label = labels[keys[i]];
          let v = label.split("=");
          labelMap[v[0]] = v[1];
        }
        values.labels = labelMap;
        console.log("values:", values);
        const resultSuccess = await this.props.onSubmit({ id, ...values });
        if (resultSuccess) {
          if (id) {
            message.success("修改成功");
          } else {
            message.success("添加成功");
          }
          this.setState({
            id: 0,
          });
        }
      }
    });
  };
  handleCancel = (e) => {
    this.props.onClose();
    const { form } = this.props;
    form.resetFields();
    this.setState({
      id: 0,
    });
  };
  forChange = (e) => {
    const { value } = e.target;
    e.target.value = `${parseFloat(value) || ""}s`;
  };

  getInitialKeys() {
    formId = 0;
    let labels = this.props.form.getFieldValue("labels");
    if (!labels) {
      return [];
    }
    const keys = [];
    let i = 0;
    for (let _ in labels) {
      keys.push(i++);
    }
    return keys;
  }

  getFields() {
    const { getFieldDecorator, getFieldValue } = this.props.form;

    getFieldDecorator("keys", { initialValue: this.getInitialKeys() });
    let keys = getFieldValue("keys");
    if (keys.length === 0) {
      formId = 0;
    } else {
      formId = Math.max(...keys) + 1;
    }

    const formItems = keys.map((k, index) => (
      <Form.Item
        {...(index === 0 ? formItemLayout : formItemLayoutWithOutLabel)}
        label={index === 0 ? "标签" : ""}
        required={false}
        key={k}
        style={{ position: "relative" }}
      >
        {getFieldDecorator(`labels[${k}]`, {
          validateTrigger: ["onBlur"],
          rules: [
            {
              required: true,
              whitespace: true,
              message: "标签.",
            },
            {
              pattern: new RegExp(/^[a-zA-Z0-9]+=\S+/),
              message: "请输入正确的标签!",
            },
          ],
        })(<Input style={{ width: "260px", marginRight: 8 }} />)}
        <Icon
          className="dynamic-delete-button"
          type="minus-circle-o"
          onClick={() => this.remove(k)}
        />
      </Form.Item>
    ));
    return formItems;
  }

  add() {
    const { form } = this.props;
    const keys = form.getFieldValue("keys");
    const nextKeys = keys.concat(formId++);
    form.setFieldsValue({
      keys: nextKeys,
    });
  }

  remove(k) {
    const { form } = this.props;
    const keys = form.getFieldValue("keys");
    form.setFieldsValue({
      keys: keys.filter((key) => key !== k),
    });
  }

  render() {
    const { visiable, promethusData, strategyData } = this.props;
    const { getFieldDecorator } = this.props.form;
    const { id } = this.state;
    return (
      <Modal
        title={id ? "编辑报警规则管理" : "添加报警规则管理"}
        visible={visiable}
        onOk={this.handleOk}
        onCancel={this.handleCancel}
        maskClosable={false}
      >
        <Form {...formItemLayout} layout="horizontal">
          <Form.Item label="标题">
            {getFieldDecorator("alert", {
              rules: [{ required: true, message: "请输入标题" }],
            })(<Input />)}
          </Form.Item>
          <Form.Item label="prom表达式">
            {getFieldDecorator("expr", {
              rules: [{ required: true, message: "请输入监控指标" }],
            })(<Input />)}
          </Form.Item>
          <Form.Item label="持续时间">
            {getFieldDecorator("for", {
              initialValue: "0s",
              rules: [{ required: true, message: "请输入持续时间" }],
            })(<Input onChange={this.forChange} />)}
          </Form.Item>
          {this.getFields()}
          <Form.Item {...formItemLayoutWithOutLabel}>
            <Button
              type="dashed"
              onClick={() => this.add()}
              style={{ width: "60%" }}
              icon={<PlusOutlined />}
            >
              添加标签
            </Button>
          </Form.Item>
          <Form.Item label="概要">
            {getFieldDecorator("summary", {
              rules: [{ required: true, message: "请输入概要" }],
            })(<Input />)}
          </Form.Item>
          <Form.Item label="描述">
            {getFieldDecorator("description", {
              rules: [],
            })(<Input />)}
          </Form.Item>
          <Form.Item label="数据源">
            {getFieldDecorator("prom_id", {
              rules: [{ required: true, message: "请输入数据源" }],
            })(
              <Select style={{ width: "100%" }}>
                {promethusData &&
                  promethusData.map((item) => (
                    <Option value={item.id}>{item.name}</Option>
                  ))}
              </Select>
            )}
          </Form.Item>
          <Form.Item label="策略">
            {getFieldDecorator("plan_id", {
              rules: [{ required: true, message: "请输入策略" }],
            })(
              <Select style={{ width: "100%" }}>
                {strategyData &&
                  strategyData.map((item) => (
                    <Option value={item.id}>{item.description}</Option>
                  ))}
              </Select>
            )}
          </Form.Item>
        </Form>
      </Modal>
    );
  }
}
