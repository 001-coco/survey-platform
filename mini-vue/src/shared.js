/** 判断是否为对象（含数组） */
export function isObject(value) {                                    // 导出工具函数：判断一个值是不是对象
  return typeof value === 'object' && value !== null                 // typeof null 也返回 'object'，所以必须排除 null
}                                                                    // 结束 isObject

/** Object.is 的语义化封装，额外处理 NaN */
export function hasChanged(newValue, oldValue) {                     // 判断新旧两个值是否发生了变化
  return !Object.is(newValue, oldValue)                              // Object.is 能正确处理 NaN 与 +0/-0，取反表示「变了」
}                                                                    // 结束 hasChanged

/** 遍历（for...in / Object.keys）时的依赖 key */
export const ALL_KEYS = Symbol('allKeys')                            // 代表「遍历整个对象」这件事的 key（原名 ITERATE_KEY）
                                                                     // 为什么需要它：for...in 关心的是「有哪些键」，而不是某一个键
