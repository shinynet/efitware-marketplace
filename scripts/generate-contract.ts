import { programViewSchema, scheduleViewSchema, calendarViewSchema } from '../apps/workout/planningModel.ts'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { z } from 'zod'
import { templateViewSchema } from '../apps/workout/templateModel.ts'
import { viewSchema } from '../apps/workout/model.ts'

// The product DTO may contain fields the card does not consume.
const schema = z.toJSONSchema(viewSchema, { io: 'input', target: 'draft-07' })
await mkdir(new URL('../contract/', import.meta.url), { recursive: true })
await writeFile(new URL('../contract/workout-view.schema.json', import.meta.url), `${JSON.stringify(schema, null, 2)}\n`)

await writeFile(new URL('../contract/template-view.schema.json', import.meta.url), `${JSON.stringify(z.toJSONSchema(templateViewSchema, { io: 'input', target: 'draft-07' }), null, 2)}\n`)
const html = await readFile(new URL('../dist/card/workout.html', import.meta.url))
if (html.byteLength > 1_500_000) throw new Error(`MCP App exceeds 1,500,000 bytes: ${html.byteLength}`)

for (const [name, schema] of Object.entries({ program: programViewSchema, schedule: scheduleViewSchema, calendar: calendarViewSchema })) await writeFile(new URL(`../contract/${name}-view.schema.json`, import.meta.url), `${JSON.stringify(z.toJSONSchema(schema, { io: 'input', target: 'draft-07' }), null, 2)}\n`)
