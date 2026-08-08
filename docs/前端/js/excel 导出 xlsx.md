---
title: excel 导出 xlsx
icon: mdi:file-excel
---

浏览器端使用 `xlsx`（SheetJS）+ `file-saver` 导出 Excel。

## 安装

```sh
pnpm add xlsx file-saver
```

## 完整示例

```js
import { saveAs } from "file-saver";

function excelDownloadSingle() {
  import("xlsx").then((xlsx) => {
    // 字符串转 ArrayBuffer
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
      return buf;
    }

    const { utils } = xlsx;
    const workBook = utils.book_new(); // 创建工作簿

    // 二维数组生成工作表
    const workSheet = utils.aoa_to_sheet(
      [
        [1, 2, 3, new Date()],
        [1, 2, null, 4],
      ],
      {
        sheetStubs: false,
        cellStyles: false,
        cellDates: true, // 解析为原生时间
      }
    );

    // 设置 A1-C1 单元格合并
    workSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

    // 设置行高
    // workSheet['!rows'] = [{ hpt: 50 }, { hpt: 150 }]

    // 浏览器端和 node 共有的 API。node 可直接用 xlsx.writeFile 写文件，浏览器没有该 API
    const result = xlsx.write(workBook, {
      bookType: "xlsx", // 输出文件类型
      type: "buffer", // 输出数据类型
      compression: true, // 开启 zip 压缩
    });

    utils.book_append_sheet(workBook, workSheet, "helloWorld"); // 追加工作表

    saveAs(
      new Blob([s2ab(result)], { type: "application/octet-stream" }),
      "test.xlsx"
    );
  });
}
```

## 对象数组生成工作表

```js
const workSheet = utils.json_to_sheet(
  [
    { 列1: 1, 列2: 2, 列3: 3 },
    { 列1: 4, 列2: 5, 列3: 6 },
  ],
  {
    header: ["列1", "列2", "列3"],
    // skipHeader: true, // 跳过标题行
  }
);
```

## 读取单元格

```js
const firstSheetName = workBook.SheetNames[0]; // 工作表名
const worksheet = workBook.Sheets[firstSheetName]; // 工作表对象
const cell = worksheet["A1"]; // 单元格对象
const value = cell ? cell.v : undefined; // 单元格数据
```
