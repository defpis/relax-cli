import fs from "fs";
import path from "path";

/**
 * 检查名称是否合法
 */
export function checkName(name: string): boolean {
  return !!name;
}

/**
 * 整理文件[夹]路径
 */
function digestPath(src: string, dist: string) {
  return [src, dist].map((p) => {
    if (p[p.length - 1] === "/") {
      return p.slice(0, p.length - 1);
    }
    return p;
  });
}

/**
 * 拷贝文件夹中的内容
 */
export function copyDir(
  src: string,
  dist: string,
  render: (value: string) => string
) {
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
    return;
  }

  const [_src, _dist] = digestPath(src, dist);

  fs.readdirSync(_src).forEach((p) => {
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
  function _copy(_src: string, _dist: string) {
    if (!fs.existsSync(_dist) || !fs.statSync(_dist).isDirectory()) {
      fs.mkdirSync(_dist);
    }

    const stat = fs.statSync(_src);

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

      const rDist = render(_dist + "/" + fileName);
      console.log(`copy file from ${_src} to ${rDist}`);
      fs.writeFileSync(rDist, fileContent);
    }

    if (stat.isDirectory()) {
      fs.readdirSync(_src).forEach((p) => {
        _copy(_src + "/" + p, render(_dist + "/" + path.basename(_src)));
      });
    }
  }

  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) {
    fs.mkdirSync(dist, { recursive: true });
  }

  const [_src, _dist] = digestPath(src, dist);
  _copy(_src, _dist);
}
