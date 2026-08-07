 
 
## table-layout 可控 w h


auto：默认值，会因为内容的原因，wh不可控
fixed：实现可控wh

```html
table{
    table-layout: fixed;
}
```
 
 
## caption 表格标题


## col、colgroup：控制列  
常用属性：span、width  

span：控制多列


```html
<table>
    <colgroup>
        <col>
        <col width="100">
        <col width="160">
    </colgroup>
    <thead>
    <tr>
        <th>题型</th>
        <th>数量</th>
        <th>分值(总分:<b>100</b>分)</th>
    </tr>
    </thead>
    <tbody>
    <tr>
        <td>选择题</td>
        <td>
            <div class="score-ipt">
                <a class="mnus"></a>
                <span>5</span>
                <a class="plus"></a>
            </div>
        </td>
        <td>
            <div class="score-ipt">
                <a class="mnus"></a>
                <span>5</span>
                <a class="plus"></a>
            </div>
        </td>
    </tr>
    </tbody>
</table>
```
