<template>
  <ul>
    <li v-for="item in items" :key="item.text">
      <div class="name">
        <i
          v-if="item.icon"
          :class="['icon', 'iconfont', 'icon-' + item.icon]"
        ></i>

        <router-link
          v-if="item.fullLink"
          :to="item.fullLink.replace(/\.md$/, '.html')"
        >
          {{ item.text }}
        </router-link>

        <span v-else class="t">
          {{ item.text }}
        </span>
      </div>

      <!-- 递归 -->
      <MenuList
        v-if="item.children && item.children.length"
        :items="item.children"
      />
    </li>
  </ul>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
})
</script>
