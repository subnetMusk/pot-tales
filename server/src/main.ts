import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import process from 'node:process'
import apiRouter from './routes/api'
import sessionRouter from './routes/session'
import path from 'node:path'

// cattura errori non gestiti e rejection
process.on('uncaughtException', (err: any) => {
  console.error('‼️ Uncaught exception:', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason: any) => {
  console.error('‼️ Unhandled rejection:', reason)
  process.exit(1)
})

const app = express()

// connessione a Mongo
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://db:27017/database')
  .then(() => console.log('✅ MongoDB connesso'))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

// body parser JSON
app.use(express.json())

// serve la cartella public per i file statici (consent.html)
app.use(express.static(path.resolve(__dirname, '../public')))

// monta i router
app.use('/', sessionRouter)
app.use('/api', apiRouter)

// legge la porta da process.env.PORT, fallback 3000
const port = Number(process.env.PORT) || 3000
app.listen(port, () => {
  console.log(`🚀 Server in ascolto su http://0.0.0.0:${port}`)
})
