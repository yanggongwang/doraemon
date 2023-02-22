import React, { Component } from "react";
import { Modal, message, Form, Input, Icon } from "antd";
import { formItemLayout } from "@configs/const";

let sourceFormId = 0;
let targetFormId = 0;

const formItemLayoutWithOutLabel = {
  wrapperCol: {
    xs: { span: 24, offset: 0 },
    sm: { span: 20, offset: 7 },
  },
};

@Form.create({})
export default class CreateEditInhibits extends Component {
  constructor(props) {
    super(props);
  }

  state = {
    id: 0,
    inhibitRule: {},
  };

  componentDidMount() {
    this.props.onRef && this.props.onRef(this);

    sourceFormId = 0;
    targetFormId = 0;
  }

  updateValue(value) {
    const { form } = this.props;
    form.resetFields();
    this.setState({
      id: value ? value.id : 0,
      inhibitRule: value,
    });

    if (value) {
      const { source_matchers, target_matchers, equal, name } = value;
      let smatchers = [];
      let tmatchers = [];

      for (let i = 0; i < source_matchers.length; i++) {
        const { label_name, expression_type, expression } = source_matchers[i];
        let operator = this.props.getStringFromExpressionType(expression_type);
        smatchers.push(label_name + operator + expression);
        // 设置数据之前需要先get,否则点击编辑的时候数据设置不上去，为空
        form.getFieldDecorator(`source_matchers[${i}]`, { initialValue: "" });
      }

      for (let i = 0; i < target_matchers.length; i++) {
        const { label_name, expression_type, expression } = target_matchers[i];
        let operator = this.props.getStringFromExpressionType(expression_type);
        tmatchers.push(label_name + operator + expression);
        // 设置数据之前需要先get,否则点击编辑的时候数据设置不上去，为空
        form.getFieldDecorator(`target_matchers[${i}]`, { initialValue: "" });
      }

      form.setFieldsValue({
        source_matchers: smatchers,
        target_matchers: tmatchers,
        equal: equal,
        name: name,
      });
    }
  }

  getSourceMatchersInitialKeys() {
    const { source_matchers } = this.state.inhibitRule;
    let nextKeys = [];
    for (let i = 0; i < source_matchers.length; i++) {
      nextKeys.push(i);
      sourceFormId++;
    }
    return nextKeys;
  }

  getTargetMatchersInitialKeys() {
    const { target_matchers } = this.state.inhibitRule;
    let nextKeys = [];
    for (let i = 0; i < target_matchers.length; i++) {
      nextKeys.push(i);
      targetFormId++;
    }
    return nextKeys;
  }

  getSourceMatcherFields() {
    const { getFieldDecorator, getFieldValue } = this.props.form;
    const { source_matchers } = this.state.inhibitRule;

    if (source_matchers) {
      getFieldDecorator("sourceKeys", {
        initialValue: this.getSourceMatchersInitialKeys(),
      });
    } else {
      getFieldDecorator("sourceKeys", { initialValue: [0] });
      let sourceKeys = getFieldValue("sourceKeys");
      sourceFormId = Math.max(...sourceKeys) + 1;
    }
    const sourceKeys = getFieldValue("sourceKeys");

    const sourceFormItems = sourceKeys.map((k, index) => (
      <Form.Item
        {...(index === 0 ? formItemLayout : formItemLayoutWithOutLabel)}
        label={index === 0 ? "源表达式" : ""}
        required={false}
        key={k}
        style={{ position: "relative" }}
      >
        {getFieldDecorator(`source_matchers[${k}]`, {
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
        <Icon type="plus-circle" onClick={() => this.addSourceMatcherForm(k)} />
        {sourceKeys.length > 1 ? (
          <Icon
            className="dynamic-delete-button"
            type="minus-circle-o"
            onClick={() => this.removeSourceMatcherForm(k)}
          />
        ) : null}
      </Form.Item>
    ));
    return sourceFormItems;
  }

  getTargetMatcherFields() {
    const { getFieldDecorator, getFieldValue } = this.props.form;
    const { target_matchers } = this.state.inhibitRule;

    if (target_matchers) {
      getFieldDecorator("targetKeys", {
        initialValue: this.getTargetMatchersInitialKeys(),
      });
    } else {
      getFieldDecorator("targetKeys", { initialValue: [0] });
      let targetKeys = getFieldValue("targetKeys");
      targetFormId = Math.max(...targetKeys) + 1;
    }
    const targetKeys = getFieldValue("targetKeys");
    const targetFormItems = targetKeys.map((k, index) => (
      <Form.Item
        {...(index === 0 ? formItemLayout : formItemLayoutWithOutLabel)}
        label={index === 0 ? "目标表达式" : ""}
        required={false}
        key={k}
        style={{ position: "relative" }}
      >
        {getFieldDecorator(`target_matchers[${k}]`, {
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
        <Icon type="plus-circle" onClick={() => this.addTargetMatcherForm(k)} />
        {targetKeys.length > 1 ? (
          <Icon
            className="dynamic-delete-button"
            type="minus-circle-o"
            onClick={() => this.removeTargetMatcherForm(k)}
          />
        ) : null}
      </Form.Item>
    ));
    return targetFormItems;
  }

  getFields() {
    const sourceMatcherFormItems = this.getSourceMatcherFields();
    const targetMatcherFormItems = this.getTargetMatcherFields();
    return (
      <div>
        {sourceMatcherFormItems}
        <Form.Item {...formItemLayoutWithOutLabel}></Form.Item>
        {targetMatcherFormItems}
        <Form.Item {...formItemLayoutWithOutLabel}></Form.Item>
      </div>
    );
  }

  handleSubmit = (e) => {
    e && e.preventDefault && e.preventDefault();
    this.props.form.validateFields((err, values) => {
      if (!err) {
        console.log(values);
        this.props.onSubmit(values);
      }
    });
  };

  handleOk = (e) => {
    this.props.form.validateFields(async (err, values) => {
      if (!err) {
        const { id } = this.state;
        const { sourceKeys, source_matchers } = values;
        let smatchers = this.transStrArray2ExpressionArray(
          sourceKeys,
          source_matchers
        );
        const { targetKeys, target_matchers } = values;
        let tmatchers = this.transStrArray2ExpressionArray(
          targetKeys,
          target_matchers
        );
        const resultSuccess = await this.props.onSubmit({
          id,
          name: values.name,
          equal: values.equal,
          source_matchers: smatchers,
          target_matchers: tmatchers,
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

  removeSourceMatcherForm = (k) => {
    const { form } = this.props;
    const keys = form.getFieldValue("sourceKeys");
    if (keys.length === 1) {
      return;
    }

    form.setFieldsValue({
      sourceKeys: keys.filter((key) => key !== k),
    });
  };

  removeTargetMatcherForm = (k) => {
    const { form } = this.props;
    const keys = form.getFieldValue("targetKeys");
    if (keys.length === 1) {
      return;
    }

    form.setFieldsValue({
      targetKeys: keys.filter((key) => key !== k),
    });
  };

  addSourceMatcherForm = () => {
    const { form } = this.props;
    const keys = form.getFieldValue("sourceKeys");
    const nextKeys = keys.concat(sourceFormId++);
    form.setFieldsValue({
      sourceKeys: nextKeys,
    });
  };

  addTargetMatcherForm = () => {
    const { form } = this.props;
    const keys = form.getFieldValue("targetKeys");
    const nextKeys = keys.concat(targetFormId++);
    form.setFieldsValue({
      targetKeys: nextKeys,
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
        <Form
          {...formItemLayout}
          layout="horizontal"
          onSubmit={this.handleSubmit}
        >
          <Form.Item label="名称">
            {getFieldDecorator("name", {
              rules: [{ required: true }],
            })(<Input />)}
          </Form.Item>
          {this.getFields()}
          <Form.Item label="相等标签">
            {getFieldDecorator("equal", {
              rules: [{ required: false }],
            })(<Input />)}
          </Form.Item>
        </Form>
      </Modal>
    );
  }
}
