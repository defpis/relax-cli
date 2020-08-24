import fs from "fs";
import path from "path";

/**
 * 检查名称是否合法
 */
export function checkName(name: string): boolean {
  // TODO 校验名称合法性
  return !!name;
}

/**
 * 整理文件[夹]路径，除去结尾多余的'/'
 */
function digestPath(p: string) {
  if (p[p.length - 1] === "/") {
    return p.slice(0, p.length - 1);
  }
  return p;
}

/**
 * 拷贝文件夹中的内容
 */
export function copyDir(
  src: string,
  dist: string,
  render: (value: string) => string
) {
  // 如果不是文件夹，跳过
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    return;
  }

  // 整理源路径和目标路径
  const _src = digestPath(src);
  const _dist = digestPath(dist);

  // 从文件夹下一级目录开始拷贝
  fs.readdirSync(_src).forEach((p: string) => {
    copy(_src + "/" + p, _dist, render);
  });
}

/**
 * 复制文件或文件夹
 */
export function copy(
  src: string,
  dist: string,
  render: (value: string) => string
) {
  // 递归拷贝
  function _copy(_src: string, _dist: string) {
    // 创建目标文件夹
    if (!fs.existsSync(_dist) || !fs.statSync(_dist).isDirectory()) {
      fs.mkdirSync(_dist);
    }

    // 读取源文件
    const stat = fs.statSync(_src);

    // 处理文件
    if (stat.isFile()) {
      let fileName = path.basename(_src);
      const fileExt = path.extname(fileName);
      let fileContent = fs.readFileSync(_src, "utf-8");

      // 所有的文件[夹]名称会被解析
      // 只有.art结尾的文件内容会被解析
      if (fileExt === ".art") {
        fileName = fileName.slice(0, -4);
        fileContent = render(fileContent);
      }

      // 渲染文件名和拷贝文件内容
      const rDist = render(_dist + "/" + fileName);
      console.log(`copy file from ${_src} to ${rDist}`);
      fs.writeFileSync(rDist, fileContent);
    }

    // 递归文件夹
    if (stat.isDirectory()) {
      fs.readdirSync(_src).forEach((p) => {
        _copy(_src + "/" + p, render(_dist + "/" + path.basename(_src)));
      });
    }
  }

  // 如果目标路径不存在，创建
  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) {
    fs.mkdirSync(dist, { recursive: true });
  }

  // 整理源路径和目标路径
  const _src = digestPath(src);
  const _dist = digestPath(dist);

  // 创建文件夹和拷贝文件
  _copy(_src, _dist);
}
