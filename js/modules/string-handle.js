/**
 * Created by cql on 2017/4/20.
 */


/**
 * 索引转大写
 * */
export function toLetter(index) {
    index *= 1;
    return String.fromCharCode(65 + index);
}

/**
 * 索引转小写*/
export function toLowerLetter(index) {
    index *= 1;
    return String.fromCharCode(97 + index);
}

/**
 * 大写字母转索引
 * */
export function letterToIndex(letter) {
    return letter.charCodeAt() - 65;
};

