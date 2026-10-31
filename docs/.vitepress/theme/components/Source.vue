<script setup lang="ts">
import { computed } from 'vue'
import { useLang } from '../composables/useLang'

/**
 * 统一的官方来源引用：新标签页打开原文，hover 给出「可跳转原文」提示。
 * One citation style for every source link, always opening in a new tab.
 */
const props = defineProps<{ href: string; org?: string; label?: string }>()
const { t } = useLang()

const text = computed(() => props.label ?? props.href.replace(/^https?:\/\//, ''))
</script>

<template>
  <a
    class="a-source"
    :href="props.href"
    target="_blank"
    rel="noreferrer noopener"
    :title="t('在新标签页打开官方原文', 'Open the official source in a new tab')"
  >
    <span class="a-source__tag">{{ t('参考来源', 'Source') }}</span>
    <span class="a-source__text">
      <span v-if="props.org" class="a-source__org">{{ props.org }} · </span>{{ text }}
    </span>
    <span class="a-source__arrow" aria-hidden="true">↗</span>
  </a>
</template>
