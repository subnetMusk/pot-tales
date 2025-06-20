import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

mongoose.connect('mongodb://root:example@mongodb:27017/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: 'admin'
}).then(async () => {
  console.log('Connected to MongoDB');

  // Example: Define a schema/model and query documents
  const MyCollectionSchema = new mongoose.Schema({
    name: String
  });
  const MyCollection = mongoose.model('MyCollection', MyCollectionSchema);

  // Find all documents in 'mycollection' and print them
  const docs = await MyCollection.find();
  console.log('Documents in mycollection:', docs);

  // Optionally, insert a new document if collection is empty
  if (docs.length === 0) {
    const newDoc = new MyCollection({ name: 'test' });
    await newDoc.save();
    console.log('Inserted example document:', newDoc);
  }

}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = express.Router()

router.get('/:id', (req, res) => {
  const sceneId = req.params.id
  const scenePath = path.join(__dirname, '../scenes', `${sceneId}.scene.base.json`)

  if (!fs.existsSync(scenePath)) {
    return res.status(404).json({ error: 'Scene not found' })
  }

  const raw = fs.readFileSync(scenePath, 'utf-8')
  const sceneData = JSON.parse(raw)

  // Optional: filtro dinamico (mock)
  const filtered = {
    ...sceneData,
    assets: sceneData.assets.map(a => ({
      ...a,
      url: `/assets/${path.basename(a.url)}`
    }))
  }

  res.json(filtered)
})

export default router