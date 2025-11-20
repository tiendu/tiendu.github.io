---
layout: post
title: "Bash Parameter Expansion: Made Simple"
date: 2025-11-20
categories: []
---

# Bash Parameter Expansion — Tiny Mental Model

| Pattern        | Meaning (1-liner)                               | Example → Result                |
|----------------|--------------------------------------------------|---------------------------------|
| `${v:-x}`      | default if empty **or** unset                    | `${a:-hi}` → `hi`               |
| `${v-x}`       | default only if **unset**                        | `${a-hi}` → `""` if a=""        |
| `${v:=x}`      | assign default if empty/unset                    | `${a:=hi}` sets a="hi"          |
| `${v:?msg}`    | error if empty/unset                             | `${a:?nope}`                    |
| `${v:+x}`      | use x *only if v is set*                         | `${a:+yes}`                     |
| `${v#pat}`     | trim shortest front match                        | `${p#*/}` → after first `/`     |
| `${v##pat}`    | trim longest front match                         | `${p##*/}` → basename           |
| `${v%pat}`     | trim shortest back match                         | `${p%/*}` → dirname             |
| `${v%%pat}`    | trim longest back match                          | `${f%%.*}` → no extensions      |
| `${v/p/r}`     | replace first                                    | `${x/-/_}`                      |
| `${v//p/r}`    | replace all                                      | `${x//-/_}`                     |
| `${#v}`        | length                                           | `${#s}` → number                |
| `${v:pos}`     | substring                                        | `${s:2}`                        |
| `${v:pos:len}` | substring (bounded)                              | `${s:2:3}`                      |
| `${v^}`/`${v,}`| upper/lower 1st char                             | `"hello"^` → `Hello`            |
| `${v^^}`/`${v,,}`| upper/lower all                                | `"hi"^^` → `HI`                 |

---

## **Mini Mental Models (memorize these only)**

- **`:-`** → *default if nothing there*  
- **`:?`** → *must exist or die*  
- **`#`** → *trim front*  
- **`%`** → *trim back*  
- **`##`/`%%`** → *trim more*  
- **`//`** → *replace all*  
- **`${v##*/}`** → *basename*  
- **`${v%/*}`** → *dirname*  
- **`${v%/}`** → *remove trailing slash*  
- **`${dir%/}/$file`** → *safe path join*

That's the entire Bash expansion universe in one tiny table.