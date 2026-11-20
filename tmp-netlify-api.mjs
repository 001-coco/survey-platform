import fs from 'node:fs'

const cfg = JSON.parse(fs.readFileSync(`${process.env.APPDATA}\\netlify\\Config\\config.json`, 'utf8'))
const token = cfg.users[Object.keys(cfg.users)[0]].auth?.token
const siteId = '852cc62c-3e24-49de-8596-70ba6a702509'
const H = { Authorization: `Bearer ${token}` }

const listRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=1`, { headers: H })
const [deploy] = await listRes.json()
console.log('deploy id  :', deploy.id, '| state:', deploy.state)
console.log('has functions field:', Array.isArray(deploy.functions), deploy.functions?.length)

if (deploy.functions?.length) {
  for (const fn of deploy.functions) {
    console.log('  fn:', fn.name, '| runtime:', fn.runtime, '| routes:', JSON.stringify(fn.routes || fn.paths || null))
  }
}

const fnRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}`, { headers: H })
const d = await fnRes.json()
console.log('\n--- deploy 详情里的函数相关键 ---')
for (const k of Object.keys(d)) {
  if (/func/i.test(k)) console.log(`  ${k} =`, JSON.stringify(d[k])?.slice(0, 300))
}
