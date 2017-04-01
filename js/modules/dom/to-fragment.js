/**
 * 转 DocumentFragment
 *
 * Created by cql on 2017/4/1.
 *
 *
 * @param newitems 元素集合,可以是装载元素的数组,或者是jq对象，或者 HTMLCollection
 *                 这里没兼容html字符串是考虑到 node 和 elem 情况
 * @param cb 循环回调，每处理一个元素便回调一次，传入索引
 *
 * */
export default function toFragment(newitems,cb=()=>{}) {
    let df = document.createDocumentFragment();
    let newCount = newitems.length;

    /// 1 先处理第一个，识别 HTMLCollection 与 数组、jq对象
    let getItem = function (i) {
        return newitems[i]
    };
    let item = newitems[0];
    df.appendChild(item);
    cb(0,item);

    // HTMLCollection 情况
    if (newitems.length < newCount) {
        getItem = function () {
            return newitems[0]
        }
    }

    /// 2 处理剩下的
    for (let i = 1; i < newCount; i++) {
        let item = getItem(i);
        df.appendChild(item);
        cb(i,item);
    }

    return df;
}