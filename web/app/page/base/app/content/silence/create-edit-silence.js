import React, { Component } from "react";
import {
  Modal,
  message,
  Form,
  Input,
  Icon,
  TimePicker,
  DatePicker,
} from "antd";
import { formItemLayout } from "@configs/const";
import moment from "moment";

let FormId = 0;

const { RangePicker } = DatePicker;

const formItemLayoutWithOutLabel = {
  wrapperCol: {
    xs: { span: 24, offset: 0 },
    sm: { span: 20, offset: 7 },
  },
};

@Form.create({})
export default class CreateEditSilence extends Component {
  constructor(props) {
    super(props);
  }

  state = {
    id: 0,
    silence: {
      matchers: [],
      name: "",
      starts_at: undefined,
      ends_at: undefined,
    },
  };

  componentDidMount() {
    this.props.onRef && this.props.onRef(this);

    FormId = 0;
  }

  updateValue(value) {
    const { form } = this.props;
    form.resetFields();
    this.setState({
      id: value ? value.id : 0,
      silence: value,
    });

    if (value) {
      const { matchers, name } = value;
      let mcs = [];

      for (let i = 0; i < matchers.length; i++) {
        const { label_name, expression_type, expression } = matchers[i];
        let operator = this.props.getStringFromExpressionType(expression_type);
        mcs.push(label_name + operator + expression);
        // 设置数据之前需要先get,否则点击编辑的时候数据设置不上去，为空
        form.getFieldDecorator(`matchers[${i}]`, { initialValue: "" });
      }

      form.getFieldDecorator("time_range", { initialValue: [] });
      form.setFieldsValue({
        time_range: [moment(value.starts_at), moment(value.ends_at)],
      });

      form.setFieldsValue({
        matchers: mcs,
        name: name,
      });
    }
  }

  getMatchersInitialKeys() {
    const { matchers } = this.state.silence;
    let nextKeys = [];
    for (let i = 0; i < matchers.length; i++) {
      nextKeys.push(i);
      FormId++;
    }
    return nextKeys;
  }

  getMatcherFields() {
    const { getFieldDecorator, getFieldValue } = this.props.form;

    if (this.state.silence !== undefined) {
      getFieldDecorator("keys", {
        initialValue: this.getMatchersInitialKeys(),
      });
    } else {
      getFieldDecorator("keys", { initialValue: [0] });
      let keys = getFieldValue("keys");
      FormId = Math.max(...keys) + 1;
    }
    const keys = getFieldValue("keys");

    const sourceFormItems = keys.map((k, index) => (
      <Form.Item
        {...(index === 0 ? formItemLayout : formItemLayoutWithOutLabel)}
        label={index === 0 ? "源表达式" : ""}
        required={false}
        key={k}
        style={{ position: "relative" }}
      >
        {getFieldDecorator(`matchers[${k}]`, {
          validateTrigger: ["onBlur"],
          rules: [
            {
              required: true,
              whitespace: true,
              message: "请输入表达式.",
            },
            {
              pattern: new RegExp(/^[a-zA-Z0-9]+(=|!=|~|!=)\S+/),
              message: "请输入正确的标签表达式!",
            },
          ],
        })(<Input style={{ width: "260px", marginRight: 8 }} />)}
        <Icon type="plus-circle" onClick={() => this.addMatcherForm(k)} />
        {keys.length > 1 ? (
          <Icon
            className="dynamic-delete-button"
            type="minus-circle-o"
            onClick={() => this.removeMatcherForm(k)}
          />
        ) : null}
      </Form.Item>
    ));
    return sourceFormItems;
  }

  getFields() {
    const matcherFormItems = this.getMatcherFields();
    return (
      <div>
        {matcherFormItems}
        <Form.Item {...formItemLayoutWithOutLabel}></Form.Item>
      </div>
    );
  }

  // handleSubmit = (e) => {
  //   e && e.preventDefault && e.preventDefault();
  //   this.props.form.validateFields((err, values) => {
  //     if (!err) {
  //       this.props.onSubmit(values);
  //     }
  //   });
  // };

  handleOk = (e) => {
    this.props.form.validateFields(async (err, values) => {
      if (!err) {
        const { id } = this.state;
        const { keys, matchers } = values;
        let matchers_exp = this.transStrArray2ExpressionArray(keys, matchers);
        const resultSuccess = await this.props.onSubmit({
          id,
          name: values.name,
          matchers: matchers_exp,
          starts_at: values.time_range[0],
          ends_at: values.time_range[1],
        });
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

  handleFormChange = (index, event) => {
    let data = [...this.state.inputField];
    data[index][event.target.name] = event.target.value;
    this.setState({ inputField: data });
  };

  transStr2Expression(str) {
    let label_name = "";
    let expression_type = 0;
    let expression = "";
    let operator = "";
    for (let i = 0; i < str.length; i++) {
      if (str[i] == "=" || str[i] == "!" || str[i] == "~") {
        label_name = str.substring(0, i);
        if (str[i] == "!" && str[i + 1] == "=") {
          operator = "!=";
          expression = str.substring(i + 2, str.length);
        } else if (str[i] == "!" && str[i + 1] == "~") {
          operator = "!~";
          expression = str.substring(i + 2, str.length);
        } else {
          operator = str[i];
          expression = str.substring(i + 1, str.length);
        }
        break;
      }
    }
    switch (operator) {
      case "=":
        expression_type = 0;
        break;
      case "!=":
        expression_type = 1;
        break;
      case "~":
        expression_type = 2;
        break;
      case "!~":
        expression_type = 3;
        break;
    }
    return {
      label_name: label_name,
      expression_type: expression_type,
      expression: expression,
    };
  }

  transStrArray2ExpressionArray(keys, expressions) {
    let matchers = [];
    for (let i = 0; i < keys.length; i++) {
      matchers.push(this.transStr2Expression(expressions[keys[i]]));
    }
    return matchers;
  }

  removeMatcherForm = (k) => {
    const { form } = this.props;
    const keys = form.getFieldValue("keys");
    if (keys.length === 1) {
      return;
    }

    form.setFieldsValue({
      keys: keys.filter((key) => key !== k),
    });
  };

  addMatcherForm = () => {
    const { form } = this.props;
    const keys = form.getFieldValue("keys");
    const nextKeys = keys.concat(FormId++);
    form.setFieldsValue({
      keys: nextKeys,
    });
  };

  render() {
    const { visiable } = this.props;
    const { getFieldDecorator, getFieldValue } = this.props.form;
    const { id } = this.state;
    const formItemLayoutWithOutLabel = {
      wrapperCol: {
        xs: { span: 24, offset: 0 },
        sm: { span: 20, offset: 4 },
      },
    };

    return (
      <Modal
        title={id ? "编辑报警抑制" : "添加报警抑制"}
        visible={visiable}
        onOk={this.handleOk}
        onCancel={this.handleCancel}
        maskClosable={false}
      >
        <Form {...formItemLayout} layout="horizontal">
          <Form.Item label="维护时间段" required style={{ marginBottom: 0 }}>
            {/* <Form.Item
              style={{ display: "inline-block", width: "calc(50% - 10px)" }}
            >
              {getFieldDecorator("starts_at", {
                rules: [
                  {
                    type: "object",
                    required: true,
                    message: "Please select time!",
                  },
                ],
              })(<TimePicker style={{ width: "100%" }} format="HH:mm" />)}
            </Form.Item>
            <span
              style={{
                display: "inline-block",
                width: "20px",
                textAlign: "center",
              }}
            >
              ~
            </span>
            <Form.Item
              style={{ display: "inline-block", width: "calc(50% - 10px)" }}
            >
              {getFieldDecorator("ends_at", {
                rules: [
                  {
                    type: "object",
                    required: true,
                    message: "Please select time!",
                  },
                ],
              })(<TimePicker style={{ width: "100%" }} format="HH:mm" />)}
            </Form.Item> */}
            <Form.Item>
              {getFieldDecorator("time_range", {
                rules: [
                  {
                    type: "array",
                    required: true,
                    message: "Please select time!",
                  },
                ],
              })(<RangePicker showTime />)}
            </Form.Item>
          </Form.Item>
          <Form.Item label="名称">
            {getFieldDecorator("name", {
              rules: [{ required: true }],
            })(<Input />)}
          </Form.Item>
          {this.getFields()}
        </Form>
      </Modal>
    );
  }
}
