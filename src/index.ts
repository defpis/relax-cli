#!/usr/bin/env node

import fs from "fs";
import path from "path";
import commander from "commander";
import prompts from "prompts";
import chalk from "chalk";
import template from "art-template";
import Listr from "listr";
import execa from "execa";
import { checkName, copyDir } from "./utils";

// 模版管道
template.defaults.imports.upperCase = (value: string) => {
  return value.toUpperCase();
};

// 支持语言
const LANGUAGES = ["javascript", "typescript"];
// 内置模版
const TEMPLATE_DIR = path.resolve(path.dirname(__dirname), "./template");
// 组件模版
const WIDGET_DIR = path.resolve(path.dirname(__dirname), "./widget");
// 工作目录
const WORK_DIR = process.cwd();

/**
 * 收集配置
 */
function collect(dir: string): any {
  const result: { [k: string]: string[] } = {};
  fs.readdirSync(dir).forEach((p) => {
    if (!fs.statSync(path.resolve(dir, p)).isDirectory()) {
      return;
    }
    const names = p.split("-");
    const language = names[names.length - 1].toLowerCase();
    if (LANGUAGES.includes(language)) {
      const templateKey = names.slice(0, names.length - 1).join("-");
      if (!result[templateKey]) {
        result[templateKey] = [];
      }
      result[templateKey].push(language);
    } else {
      if (!result[p]) {
        result[p] = [];
      }
    }
  });
  return result;
}

// 模版配置
const TEMPLATES = collect(TEMPLATE_DIR);
// 组件配置
const WIDGETS = collect(WIDGET_DIR);

/**
 * 展示LOGO
 */
function showLogo() {
  /*
     ____      _
    |  _ \ ___| | __ ___  __
    | |_) / _ \ |/ _` \ \/ /
    |  _ <  __/ | (_| |>  <
    |_| \_\___|_|\__,_/_/\_\
  */
  const logo =
    " ____      _\n|  _ \\ ___| | __ ___  __\n| |_) / _ \\ |/ _` \\ \\/ /\n|  _ <  __/ | (_| |>  <\n|_| \\_\\___|_|\\__,_/_/\\_\\\n";
  console.log(chalk.green(logo));
}

/**
 * 解析CLI参数
 */
function getCmd(): commander.Command {
  const program = new commander.Command().version(
    "1.0.0",
    "-v, --version",
    "show current version"
  );

  // 创建参数
  const create = program.command("create [dir]").action((dir) => {
    if (!checkName(dir)) {
      create.help();
    }
  });

  // 生成组件
  const generate = program.command("generate [dir]").action((dir) => {
    if (!checkName(dir)) {
      generate.help();
    }
  });

  // 解析参数
  program.parse(process.argv);

  return program;
}

/**
 * 复制模版
 */
function copyTemplate(
  src: string,
  dist: string,
  templateArgs?: { [k: string]: any }
) {
  // 拷贝模版
  copyDir(src, dist, (value: string) => {
    // 渲染文件夹名、文件名和文件内容
    return template.render(value || "", templateArgs);
  });
}

/**
 * 创建应用
 */
async function createApp(cwd: string) {
  const tasks: any = [
    {
      // 初始化git
      title: `initialize git in ${cwd}`,
      task: () => {
        // npm pack 导致 .gitignore -> .npmignore
        // https://github.com/npm/npm/issues/7252
        if (fs.existsSync(`${cwd}/.npmignore`)) {
          fs.renameSync(`${cwd}/.npmignore`, `${cwd}/.gitignore`);
        }

        console.log(execa.commandSync("git init", { cwd }).stdout);
        console.log(execa.commandSync("git add --all", { cwd }).stdout);
        console.log(execa.commandSync("git status", { cwd }).stdout);
      },
    },
    {
      // 优先yarn安装依赖
      title: "install package dependencies with yarn",
      task: (ctx: any, task: any) =>
        execa.command("yarn install", { cwd }).catch(() => {
          ctx.npm = true;
          task.skip("yarn not available, install it via `npm install -g yarn`");
        }),
    },
    {
      // yarn不可用，使用npm安装依赖
      title: "install package dependencies with npm",
      enabled: (ctx: any) => ctx.npm,
      task: () => execa.command("npm install", { cwd }),
    },
  ];

  const { template } = await prompts([
    {
      // 选择模版
      message: "pick template",
      type: "select",
      name: "template",
      choices: Object.keys(TEMPLATES)
        // 可以输入链接自定义模版
        .concat(["link"])
        .map((v: string) => ({
          title: v,
          value: v,
        })),
    },
  ]);

  if (template === "link") {
    const { templateLink } = await prompts([
      {
        // 输入模版链接
        message: "template link:",
        type: "text",
        name: "templateLink",
      },
    ]);

    // 克隆到临时目录
    const tmpDir = "/tmp/relax-template-repo";
    if (fs.existsSync(tmpDir)) {
      await execa.command(`rm -rf ${tmpDir}`);
    }

    tasks.unshift(
      {
        // 克隆仓库
        title: `git clone into ${tmpDir}`,
        task: () =>
          execa
            .command(`git clone ${templateLink} ${tmpDir}`)
            .then(() => execa.command(`rm -rf ${tmpDir}/.git`)),
      },
      {
        // 拷贝到工作目录
        title: `copy template into ${cwd}`,
        task: () => {
          copyTemplate(tmpDir, cwd, {
            PROJECT_NAME: path.basename(cwd),
          });
        },
      }
    );
  } else {
    let targetTemplate = template;
    const languages = TEMPLATES[template];

    // 只有一个选项时跳过选择
    if (languages.length === 1) {
      targetTemplate = `${template}-${languages[0]}`;
    }

    if (languages.length > 1) {
      const { language } = await prompts([
        {
          // 选择语言 javascript/typescript
          message: "pick language",
          type: "select",
          name: "language",
          choices: languages.map((v: string) => ({
            title: v,
            value: v,
          })),
        },
      ]);
      targetTemplate = `${template}-${language}`;
    }

    tasks.unshift({
      // 拷贝内置模版到工作目录
      title: `copy template into ${cwd}`,
      task: () => {
        copyTemplate(path.resolve(TEMPLATE_DIR, targetTemplate), cwd, {
          PROJECT_NAME: path.basename(cwd),
        });
      },
    });
  }
  // 执行任务流
  return new Listr(tasks).run();
}

async function generate(cwd: string) {
  const { widget } = await prompts([
    {
      // 选择模版
      message: "pick widget",
      type: "select",
      name: "widget",
      choices: Object.keys(WIDGETS).map((v: string) => ({
        title: v,
        value: v,
      })),
    },
  ]);

  let targetWidget = widget;
  const languages = WIDGETS[widget];

  if (languages.length === 1) {
    targetWidget = `${widget}-${languages[0]}`;
  }

  if (languages.length > 1) {
    const { language } = await prompts([
      {
        message: "pick language",
        type: "select",
        name: "language",
        choices: languages.map((v: string) => ({
          title: v,
          value: v,
        })),
      },
    ]);
    targetWidget = `${widget}-${language}`;
  }

  copyTemplate(path.resolve(WIDGET_DIR, targetWidget), cwd, {
    WIDGET_NAME: path.basename(cwd),
  });
}

/**
 * 主程序入口
 */
function cli() {
  showLogo();
  // 命令参数
  const cmd = getCmd();
  // 工作目录
  const cwd = path.resolve(WORK_DIR, cmd.args[1]);
  // 创建应用
  if (cmd.args[0] === "create" && !fs.existsSync(cwd)) {
    createApp(cwd);
  }
  if (cmd.args[0] === "generate" && !fs.existsSync(cwd)) {
    generate(cwd);
  }
}

if (require.main === module) {
  cli();
}
