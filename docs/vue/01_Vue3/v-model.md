## 双向绑定实现


组件内双向绑定实现方案，涉及多级 modelValue 嵌套



### 1. 直接使用 props.modelValue


```vue
<script lang="ts" setup>
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [v: string];
}>();

function onInput(v: string) {
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="InputDemo">
    <el-input :model-value="modelValue" @input="onInput" />
  </div>
</template>
```



### 2. 通过 watchEffect


适用组件内已单独声明值的情况，属于更灵活的方式，方便后期扩展



watchEffect 只负责进值，如果出值，需仔细确认，否则可能死循环



实时改变的例子：



```vue
<script lang="ts" setup>
const props = defineProps<{
  modelValue: string;
}>();

const value = ref('');

watchEffect(() => {
  value.value = props.modelValue;
});

const emit = defineEmits<{
  'update:modelValue': [v: string];
}>();

function onInput(v: string) {
  emit('update:modelValue', v);
}
</script>

<template>
  <div class="InputDemo">
    <el-input :model-value="modelValue" @input="onInput" />
  </div>
</template>
```



带确认修改的例子：



```vue
<script lang="ts" setup>
const props = defineProps<{
  modelValue: string;
}>();

const value = ref('');

watchEffect(() => {
  value.value = props.modelValue;
});

const emit = defineEmits<{
  'update:modelValue': [v: string];
}>();

function confirm() {
  emit('update:modelValue', value.value);
}
</script>

<template>
  <div class="InputDemo">
    <el-input v-model="value" />
    <button @click="confirm">确认修改</button>
  </div>
</template>
```



### 3. 通过计算属性



一般情况



```vue
<script lang="ts" setup>
const props = defineProps<{
  modelValue: { v: string };
}>();

const emit = defineEmits<{
  'update:modelValue': [v: string];
}>();
const value = computed({
  get() {
    return props.modelValue;
  },
  set(val) {
    emit('update:modelValue', val);
  },
});

function onInput(v: string) {
  value.value = v;
}
</script>

<template>
  <div class="InputDemo">
    <el-input :model-value="modelValue" @input="onInput" />
  </div>
</template>
```



对象引用情况，emit 可以不要



```vue
<script lang="ts" setup>
const props = defineProps<{
  modelValue: { v: string };
}>();

const value = computed({
  get() {
    return props.modelValue.v;
  },
  set(val) {
    props.modelValue.v = val;
  },
});

function onInput(v: string) {
  value.value = v;
}
</script>

<template>
  <div class="InputDemo">
    <el-input :model-value="modelValue" @input="onInput" />
  </div>
</template>
```

