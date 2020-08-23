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

template.defaults.imports.upperCase = (value: string) => {
  return value.toUpperCase();
};

const TEMPLATE_DIR = path.resolve(path.dirname(__dirname), "./template");
const WORK_DIR = process.cwd();

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

  const create = program.command("create [dir]").action((dir) => {
    if (!checkName(dir)) {
      create.help();
    }
  });

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
  copyDir(src, dist, (value: string) => {
    return template.render(value || "", templateArgs);
  });
}

/**
 * 创建应用
 */
async function createApp(cwd: string) {
  const tasks: any = [
    {
      title: `initialize git in ${cwd}`,
      task: () => {
        console.log(execa.commandSync("git init", { cwd }).stdout);
        console.log(execa.commandSync("git add --all", { cwd }).stdout);
        console.log(execa.commandSync("git status", { cwd }).stdout);
      },
    },
    {
      title: "install package dependencies with yarn",
      task: (ctx: any, task: any) =>
        execa.command("yarn install", { cwd }).catch(() => {
          ctx.npm = true;
          task.skip("yarn not available, install it via `npm install -g yarn`");
        }),
    },
    {
      title: "install package dependencies with npm",
      enabled: (ctx: any) => ctx.npm,
      task: () => execa.command("npm install", { cwd }),
    },
  ];

  const { template } = await prompts([
    {
      message: "pick template",
      type: "select",
      name: "template",
      choices: [
        { title: "simple", value: "simple" },
        { title: "link", value: "link" },
      ],
    },
  ]);

  if (template === "link") {
    const { templateLink } = await prompts([
      {
        message: "template link:",
        type: "text",
        name: "templateLink",
      },
    ]);

    const tmpDir = "/tmp/relax-template-repo";
    if (fs.existsSync(tmpDir)) {
      await execa.command(`rm -rf ${tmpDir}`);
    }

    tasks.unshift(
      {
        title: `git clone into ${tmpDir}`,
        task: () =>
          execa
            .command(`git clone ${templateLink} ${tmpDir}`)
            .then(() => execa.command(`rm -rf ${tmpDir}/.git`)),
      },
      {
        title: `copy template into ${cwd}`,
        task: () => {
          copyTemplate(tmpDir, cwd, {
            PROJECT_NAME: path.basename(cwd),
          });
        },
      }
    );
  } else {
    const { language } = await prompts([
      {
        message: "pick language",
        type: "select",
        name: "language",
        choices: [
          { title: "javascript", value: "javascript" },
          { title: "typescript", value: "typescript" },
        ],
      },
    ]);
    tasks.unshift({
      title: `copy template into ${cwd}`,
      task: () => {
        copyTemplate(
          path.resolve(TEMPLATE_DIR, `${template}-${language}`),
          cwd,
          {
            PROJECT_NAME: path.basename(cwd),
          }
        );
      },
    });
  }
  return new Listr(tasks).run();
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

  if (cmd.args[0] === "create" && !fs.existsSync(cwd)) {
    createApp(cwd);
  }
}

if (require.main === module) {
  cli();
}
