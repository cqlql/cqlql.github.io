
/**
 * 自动加前缀
 * 可用 box-flex 进行测试
 *
 * @param cssPropertyName {string} 减号方式的css名称
 * @return {Array} 数组中有两个值，第一个是 减号风格，第二个是驼峰。如果不支持此属性，返回null
 *
 * @example
 * var transform = autoPrefix('transform')[1]
 * var transition = autoPrefix('transition')[1]
 *
 * */
export default function autoPrefix(cssPropertyName) {
    // 如果有直接返回
    var propertyName = autoPrefix[cssPropertyName];
    if (propertyName !== undefined) return propertyName;

    var
        firstLetter = cssPropertyName[0],
        firstLetterUpper = firstLetter.toUpperCase(),
        cssPrefixes = ["ms" + firstLetterUpper, "Moz" + firstLetterUpper, "webkit" + firstLetterUpper, firstLetter],
        cssPrefixesReal = ["-ms-", "-Moz-", "-webkit-", ''],
        style = document.body.style,
        // css名称转换
        name = cssPropertyName.replace(/-\w/g, function (d) {
            return d[1].toUpperCase();
        }).substr(1);

    for (var i = cssPrefixes.length, newName; i--;) {
        newName = cssPrefixes[i] + name;

        if (newName in style) {
            propertyName = [cssPrefixesReal[i] + cssPropertyName, newName];
            break;
        }
    }

    propertyName = propertyName || null;

    autoPrefix[cssPropertyName] = propertyName;

    return propertyName;
}
