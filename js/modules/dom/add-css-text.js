/**
 * Created by cql on 2017/3/31.
 */

/**
 * 增加css 文本
 * */
export default function addCssText(txt) {
    let eStyle = document.createElement('style');

    if ('textContent' in eStyle) {
        eStyle.textContent = txt;
        document.head.appendChild(eStyle);
    }
    else {
        // ie678
        eStyle.setAttribute("type", "text/css");
        eStyle.styleSheet.cssText = txt;
        document.body.appendChild(eStyle);
    }
}
