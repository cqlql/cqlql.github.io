/**
 * Created by cql on 2017/3/7.
 * 944191
 */

import Vue from 'vue';
import CryptoJS from 'aes';
import {} from 'click-vue';
import ajax from 'ajax';


let vm = new Vue({
    el: document.querySelector('.pw-list'),
    data: {
        key: '',
        list: window.mainData,
        // 这只是引用，引用mainData
        item: window.mainData[0],
        itemEdit: {
            name: '123',
            pw: '222',
            des: '这是说明'
        },
        operation: 'add',

        popupTitle: ''
    },
    created(){
        // 默认选中第一个
        this.item.index = 0;
    },
    methods: {

        isLogin(){
            if (this.login) {

                return 1;
            }
            vm.$refs.key.focus();
            return 0;
        },
        itemActive(e){

            let target = e.target;
            if (target.tagName === 'LI') {

                let index = target.dataset.index;

                vm.item = vm.list[target.dataset.index];

                vm.item.index = index * 1;

                this.hidepwd();
            }
        },

        add(e){
            if (!this.isLogin())return;

            for (let key in this.itemEdit) {
                this.itemEdit[key] = '';
            }

            vm.$refs.pwop.classList.add('show');
            vm.operation = 'add';
            this.popupTitle = '新增';

        },
        edit(){
            if (!this.isLogin())return;

            for (let k in this.item) {
                this.itemEdit[k] = this.item[k];
            }

            this.itemEdit['pw'] = this.decrypt(this.itemEdit['pw']);

            vm.$refs.pwop.classList.add('show');
            vm.operation = 'edit';
            this.popupTitle = '修改';
        },
        del(){
            if (!this.isLogin())return;

            if (confirm('确定删除！')) {
                let id = this.item.index;

                // 删除密码，根据索引删除
                ajax.post({
                    url: '/del',
                    data: {
                        index: id
                    },
                    success(d){
                        vm.list.splice(id, 1);
                        // 删除后选中第一个
                        vm.item = window.mainData[0];
                        vm.item.index = 0;
                    }
                });
            }
        },

        clickLiveWin(e){
            let target = e.target,
                classList = target.classList;

            if (classList.contains('fgp-main') || classList.contains('cancel')) {
                this.$refs.pwop.classList.remove('show');
            }
            else if (classList.contains('save')) {

                let name= this.itemEdit.name;
                let pw=this.itemEdit.pw;
                let des= this.itemEdit.des;

                let err=0;

                // 非空验证
                if(!pw.trim().length){
                    err=1;
                }
                else if(!name.trim().length){
                    err=1;
                }

                if(err){
                    return ;
                }

                let data = {
                    name: name,
                    pw: this.encrypt(pw),
                    des: des
                };

                switch (this.operation) {
                    case  'add':

                        // 新增密码
                        ajax.post({
                            url: '/add',
                            data: data,
                            success(d){
                                vm.$refs.pwop.classList.remove('show');

                                // 选中增加项

                                data.index = vm.list.length;
                                vm.item = data;
                                vm.list.push(data);
                            }
                        });
                        break;
                    case 'edit':
                        let id = this.item.index;
                        // 修改密码，根据索引修改
                        ajax.post({
                            url: '/edit',
                            data: {
                                index: id,
                                d: data
                            },
                            success(d){

                                for (let k in data) {
                                    vm.item[k] = vm.list[id][k] = data[k];
                                }

                                vm.$refs.pwop.classList.remove('show');
                            }
                        });

                        break;

                }


            }
        },
        checkPwd(e){
            let target = this.$refs.pw;

            if (target.classList.contains('show')) {
                this.hidepwd();
            }
            else {
                target.classList.add('show');
                target.textContent = this.decrypt(this.item.pw);

            }
        },
        hidepwd(){
            this.$refs.pw.classList.remove('show');
            this.$refs.pw.textContent = '●●●●●●';
        },
        decrypt(pw){
            return CryptoJS.AES.decrypt(pw, this.key).toString(CryptoJS.enc.Utf8);
        },
        encrypt(pw){
            return CryptoJS.AES.encrypt(pw, this.key).toString();
        }
    },

    computed: {
        login(){
            return this.key && this.decrypt('U2FsdGVkX19XSset4qbiNna4AJhvZZw73JgLJ5xLtsk=');
        }
    }


});
