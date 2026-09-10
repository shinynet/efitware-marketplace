import { mkdir, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { viewSchema } from '../apps/workout/model.ts'

// The product DTO may contain fields the card does not consume.
const schema = z.toJSONSchema(viewSchema, { io: 'input', target: 'draft-07' })
await mkdir(new URL('../contract/', import.meta.url), { recursive: true })
await writeFile(new URL('../contract/workout-view.schema.json', import.meta.url), `${JSON.stringify(schema, null, 2)}\n`)
