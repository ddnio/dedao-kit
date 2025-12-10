#!/usr/bin/env node

const Module = require('module');
const path = require('path');
const register = require('esbuild-register');

// 注册 esbuild 以支持 TypeScript
register({
  target: 'es2020',
  format: 'cjs'
});

// 设置环境变量
process.env.DEDAO_COOKIE = 'token=OEL-ZJAbIzDSG5Y_1SlFjYQx; _sid=1iv6sp40q3m3cf2g72asbt23bkanwumb; _guard_device_id=1j9mo197c8TqwNHdRvJ6ymwmbafSPdPTUGBhKZh; Hm_lvt_be36b12b82a5f4eaa42c23989d277bb0=1764211108,1764588364,1764844005,1764922535; HMACCOUNT=52699DB5F843DE35; csrfToken=OEL-ZJAbIzDSG5Y_1SlFjYQx; token=OEL-ZJAbIzDSG5Y_1SlFjYQx; _clck=103brh1%5E2%5Eg1p%5E0%5E2026; Hm_lpvt_be36b12b82a5f4eaa42c23989d277bb0=1765270677; _clsk=80rlam%5E1765270776262%5E3%5E1%5Ey.clarity.ms%2Fcollect';

// 导入并运行脚本
require('./scripts/manual-test.ts');
