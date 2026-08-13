<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup>
import './assets/weather-app.css'
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

body, html {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: #0a0a1a;
  font-family: 'Inter', 'Noto Sans KR', sans-serif;
  color: white;
}
</style>
