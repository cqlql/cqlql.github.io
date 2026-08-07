
## 编写插件(或覆盖)

```js
CKEDITOR.plugins.add('cloudservices', {
	requires: 'filetools,ajax',
	onLoad: function() {
		var FileLoader = CKEDITOR.fileTools.fileLoader;

		function CloudServicesLoader( editor, fileOrData, fileName, token ) {
			FileLoader.call( this, editor, fileOrData, fileName );
		}

		CloudServicesLoader.prototype = CKEDITOR.tools.extend( {}, FileLoader.prototype );

		CKEDITOR.plugins.cloudservices.cloudServicesLoader = CloudServicesLoader;
	},
});

```

## 在线构建 build-config.js 备份

```js
var CKBUILDER_CONFIG = {
	skin: 'moono-lisa',
	// preset: 'basic',
	preset: 'full',
	ignore: [
		'.DS_Store',
		'.bender',
		'.editorconfig',
		'.gitattributes',
		'.gitignore',
		'.idea',
		'.jscsrc',
		'.jshintignore',
		'.jshintrc',
		'.mailmap',
		'.npm',
		'.travis.yml',
		'bender-err.log',
		'bender-out.log',
		'bender.ci.js',
		'bender.js',
		'dev',
		'gruntfile.js',
		'less',
		'node_modules',
		'package.json',
		'tests'
	],
	plugins : {
		// 'a11yhelp' : 1,
		// 'about' : 1,
		'basicstyles' : 1,
		'bidi' : 1,
		'blockquote' : 1,
		'clipboard' : 1,
		'colorbutton' : 1, // 字体颜色
		'colordialog' : 1,
		'contextmenu' : 1,
		'copyformatting' : 1,
		'dialogadvtab' : 1,
		'div' : 1,
		'elementspath' : 1,
		'enterkey' : 1,
		'entities' : 1,
		// 'filebrowser' : 1, // 文件上传相关
		'find' : 1,
		// 'flash' : 1,
		'floatingspace' : 1,
		'font' : 1,
		'format' : 1,
		// 'forms' : 1,
		'horizontalrule' : 1, // 插入水平线
		'htmlwriter' : 1,
		'iframe' : 1,
		'image' : 1,
		'indentblock' : 1,
		'indentlist' : 1,
		'justify' : 1,
		// 'language' : 1,
		'link' : 1,
		'list' : 1,
		'liststyle' : 1,
		'magicline' : 1,
		// 'maximize' : 1, // 最大化窗口
		// 'newpage' : 1,
		'pagebreak' : 1,
		'pastefromword' : 1,
		'pastetext' : 1,
		'preview' : 1,
		// 'print' : 1,
		'removeformat' : 1,
		'resize' : 1,
		// 'save' : 1,
		// 'scayt' : 1, // 即时拼写检查
		'selectall' : 1,
		'showblocks' : 1,
		'showborders' : 1,
		'smiley' : 1, // 表情
		'sourcearea' : 1,
		'specialchar' : 1, // 特殊字符
		'stylescombo' : 1,
		'tab' : 1,
		'table' : 1,
		'tableselection' : 1,
		'tabletools' : 1,
		// 'templates' : 1,
		'toolbar' : 1,
		'undo' : 1,
		// 'uploadimage' : 1,
		// 'wsc' : 1, // 拼写检查弹窗
		'wysiwygarea' : 1
	},
	languages : {
		'zh-cn' : 1
	}
};
```
