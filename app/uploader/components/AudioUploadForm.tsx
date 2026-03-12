'use client'

import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import { useRouter } from 'next/navigation'

interface AudioMetadata {
  dialect: string
  description: string
  speakerCount: number
  speakerGender: 'male' | 'female' | 'mixed' | 'unknown'
  speakerAgeRange: 'child' | 'teen' | 'adult' | 'senior' | 'mixed'
}

export default function AudioUploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  
  const [metadata, setMetadata] = useState<AudioMetadata>({
    dialect: 'swahili',
    description: '',
    speakerCount: 1,
    speakerGender: 'unknown',
    speakerAgeRange: 'adult'
  })

  // Supported audio formats
  const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm']
  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return 'Unsupported file format. Please upload MP3, WAV, M4A, or OGG files.'
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 50MB limit.'
    }

    return null
  }

  const handleFileSelect = (selectedFile: File) => {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
      return
    }

    setFile(selectedFile)
    setError(null)

    // Create audio preview
    const url = URL.createObjectURL(selectedFile)
    setAudioPreview(url)
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first')
      return
    }

    if (!metadata.description.trim()) {
      setError('Please provide a description')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dialect', metadata.dialect)
      formData.append('description', metadata.description)
      formData.append('speakerCount', metadata.speakerCount.toString())
      formData.append('speakerGender', metadata.speakerGender)
      formData.append('speakerAgeRange', metadata.speakerAgeRange)

      // Upload via API
      const response = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      // Success
      setUploadProgress(100)
      
      // Reset form
      setFile(null)
      setAudioPreview(null)
      setMetadata({
        dialect: 'swahili',
        description: '',
        speakerCount: 1,
        speakerGender: 'unknown',
        speakerAgeRange: 'adult'
      })

      // Refresh page to show new upload
      router.refresh()

      alert(`Upload successful! ${result.chunksCreated} chunk(s) created.`)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div
        className="border-2 border-dashed rounded-xl p-8 text-center transition-all"
        style={{
          borderColor: isDragging ? 'var(--af-primary)' : 'var(--af-line-strong)',
          background: isDragging ? 'rgba(45,212,191,0.06)' : 'var(--af-search-bg)',
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileInputChange} className="hidden" />

        {!file ? (
          <>
            <svg className="mx-auto h-12 w-12 mb-3" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true" style={{ color: 'var(--af-muted)' }}>
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm mb-3" style={{ color: 'var(--af-muted)' }}>Drag and drop your audio file here, or</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-primary">
              Browse Files
            </button>
            <p className="mt-3 text-xs" style={{ color: 'var(--af-muted)' }}>MP3, WAV, M4A, OGG up to 50MB</p>
          </>
        ) : (
          <div className="space-y-3">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#34d399' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--af-txt)' }}>{file.name}</p>
              <p className="text-xs" style={{ color: 'var(--af-muted)' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            <button type="button" onClick={() => { setFile(null); setAudioPreview(null); setError(null) }} className="text-sm" style={{ color: '#f87171' }}>
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Audio Preview */}
      {audioPreview && (
        <div>
          <label className="block text-xs mb-2" style={{ color: 'var(--af-muted)' }}>Preview</label>
          <audio controls src={audioPreview} className="w-full" style={{ filter: 'invert(0.1) hue-rotate(180deg)' }}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}

      {/* Metadata Form */}
      {file && (
        <div className="space-y-4" style={{ borderTop: '1px solid var(--af-line)', paddingTop: '1.5rem' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--af-txt)' }}>Audio Details</h3>

          {/* Dialect */}
          <div>
            <label htmlFor="dialect" className="block text-xs mb-1" style={{ color: 'var(--af-muted)' }}>
              Dialect <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select id="dialect" value={metadata.dialect} onChange={(e) => setMetadata({ ...metadata, dialect: e.target.value })} className="af-select w-full">
              <option value="swahili">Swahili</option>
              <option value="kikuyu">Kikuyu</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs mb-1" style={{ color: 'var(--af-muted)' }}>
              Description <span style={{ color: '#f87171' }}>*</span>
            </label>
            <textarea id="description" value={metadata.description} onChange={(e) => setMetadata({ ...metadata, description: e.target.value })} rows={3} placeholder="Briefly describe the audio content, context, or topic..." className="af-textarea w-full" />
          </div>

          {/* Speaker Count */}
          <div>
            <label htmlFor="speakerCount" className="block text-xs mb-1" style={{ color: 'var(--af-muted)' }}>Number of Speakers</label>
            <input type="number" id="speakerCount" min="1" max="10" value={metadata.speakerCount} onChange={(e) => setMetadata({ ...metadata, speakerCount: parseInt(e.target.value) || 1 })} className="af-input w-full" />
          </div>

          {/* Speaker Gender */}
          <div>
            <label htmlFor="speakerGender" className="block text-xs mb-1" style={{ color: 'var(--af-muted)' }}>Speaker Gender</label>
            <select id="speakerGender" value={metadata.speakerGender} onChange={(e) => setMetadata({ ...metadata, speakerGender: e.target.value as any })} className="af-select w-full">
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          {/* Speaker Age Range */}
          <div>
            <label htmlFor="speakerAgeRange" className="block text-xs mb-1" style={{ color: 'var(--af-muted)' }}>Speaker Age Range</label>
            <select id="speakerAgeRange" value={metadata.speakerAgeRange} onChange={(e) => setMetadata({ ...metadata, speakerAgeRange: e.target.value as any })} className="af-select w-full">
              <option value="adult">Adult</option>
              <option value="child">Child</option>
              <option value="teen">Teen</option>
              <option value="senior">Senior</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex gap-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          <svg className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--af-muted)' }}>Uploading…</span>
            <span className="text-xs" style={{ color: 'var(--af-muted)' }}>{uploadProgress}%</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--af-line)' }}>
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: 'var(--af-primary)' }} />
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="flex justify-end">
        <button type="button" onClick={handleUpload} disabled={!file || uploading} className="btn-primary">
          {uploading ? 'Uploading…' : 'Upload Audio'}
        </button>
      </div>
    </div>
  )
}
