[vim 常用命令总结](https://www.cnblogs.com/yangjig/p/6014198.html)

## 保存、退出、另存为

:w 保存  
:w! 强制保存
:q 退出  
ZZ :wq 保存退出
:wq! 强制保存退出
ZQ | :q! 不保存退出  
:w filename 另存为

## 撤销反撤销

撤销 `u`  
重做 `ctrl + r`

## 光标选择

按 v 键进入可视模式后，控制光标选择

全选: ggv, 然后 ctrl+End

gg 光标跳全文首位置
G 到全文末位置

## 删除

说明：
在 v 模式下，通过 Home|End|Pgup|Pgdn 键可轻松选择，然后 Del|Backspace|d 键轻松删除

**其他快捷参考：**  
dw 删除单词  
dd 删除当前行  
ggvGddd 全部删除(先跳到文本开始位置，进入选择模式，跳到最后一行，删除选择，再删除当前行)

## 复制粘贴

y 复制选中  
yy 复制整行  
p 粘贴

## 注释颜色看不起问题解决

[修改主题](https://blog.csdn.net/liuxf1993/article/details/101279218)

`sudo vi /etc/vim/vimrc` 最后一行插入 `colorscheme elflord`

主题所在目录 `/usr/share/vim/vim80/colors/`，这里用的是 vim80

## 查找替换

https://www.cnblogs.com/marsggbo/p/12152374.html

全文查找替换

`:%s/foo/bar/g` 会在 全局范围(global) 查找 foo 并替换为 bar，所有出现都会被替换。

## 通过 apt 安装

```sh
sudo apt-get install vim
```

## 全选、复制全部、删除全部

全选（高亮显示）：按 esc 后，然后 ggvG 或者 ggVG

全部复制：按 esc 后，然后 ggyG

全部删除：按 esc 后，然后 dG

解析：

gg：是让光标移到首行，在 vim 才有效，vi 中无效

v ： 是进入 Visual(可视）模式

G ：光标移到最后一行

选中内容以后就可以其他的操作了，比如： d 删除选中内容 y 复制选中内容到 0 号寄存器 "+y 复制选中内容到＋寄存器，也就是系统的剪贴板，供其他程序用
