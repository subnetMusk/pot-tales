import express from 'express'
const router = express.Router()

router.get('/scene/:id', (req, res) => {
  res.json({
    message: `Sandbox scene '${req.params.id}' mocked`,
    sandbox: true
  })
})

export default router