/**
 * Atlas Texture Type Classifier
 * 
 * Identifies texture map types (base color, normal maps, ORM maps) from atlas files
 * with high accuracy and configurable confidence thresholds.
 */

// Confidence level enum for texture classification
export const ConfidenceLevel = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown"
};

// Global constant for the acceptable confidence level
// This determines what's considered a valid match during classification
let ACCEPTABLE_CONFIDENCE = ConfidenceLevel.MEDIUM;

/**
 * Texture classifier for identifying atlas texture types
 */
export class TextureClassifier {
  constructor() {
    // Classification confidence thresholds
    this.HIGH_CONFIDENCE = 0.8;
    this.MEDIUM_CONFIDENCE = 0.6;
    this.LOW_CONFIDENCE = 0.4;
    this.UNKNOWN_CONFIDENCE = 0.0;
    
    // Map from ConfidenceLevel enum to threshold values
    this.CONFIDENCE_THRESHOLDS = {
      [ConfidenceLevel.HIGH]: this.HIGH_CONFIDENCE,
      [ConfidenceLevel.MEDIUM]: this.MEDIUM_CONFIDENCE,
      [ConfidenceLevel.LOW]: this.LOW_CONFIDENCE,
      [ConfidenceLevel.UNKNOWN]: this.UNKNOWN_CONFIDENCE
    };
    
    // Maximum pixel count to analyze for performance (will downsample larger textures)
    this.MAX_SAMPLES = 100000;
    
    // Statistical feature weights for each texture type
    this.featureWeights = {
      'base_color': {
        'colorVariance': 0.25,
        'rgbDistribution': 0.20,
        'blueChannelAvg': -0.15,
        'channelCorrelation': 0.10,
        'entropy': 0.20,
        'grayness': -0.10
      },
      'normal_map': {
        'blueChannelBias': 0.30,
        'rgbMeansNormal': 0.25,
        'normalVectorValidity': 0.25,
        'rgbDistribution': -0.10,
        'colorVariance': 0.10
      },
      'orm_map': {
        'channelIndependence': 0.25,
        'binaryMetallicScore': 0.20,
        'roughnessPattern': 0.15,
        'entropy': -0.10,
        'grayness': 0.15,
        'colorFlatness': 0.15
      }
    };
  }

  /**
   * Classify the texture type of the given image
   * @param {HTMLImageElement|ImageData|Uint8ClampedArray|URL} image - Image to classify
   * @returns {Object} Classification results
   */
  async classifyTexture(image) {
    try {
      // Load and process the image
      const imgData = await this._loadImage(image);
      if (!imgData) {
        return {
          classification: 'invalid_file',
          confidence: 1.0,
          scores: {},
          features: {},
          message: 'File could not be loaded as an image'
        };
      }
      
      // Extract features
      const features = this._extractFeatures(imgData);
      
      // Calculate scores for each texture type
      const scores = this._calculateScores(features);
      
      // Determine the classification and confidence
      const [classification, confidence] = this._determineClassification(scores);
      
      return {
        classification,
        confidence,
        scores,
        features
      };
    } catch (error) {
      return {
        classification: 'error',
        confidence: 0.0,
        scores: {},
        features: {},
        message: `Error during classification: ${error.message}`
      };
    }
  }

  /**
   * Load an image from various sources and return its pixel data
   * @param {HTMLImageElement|ImageData|Uint8ClampedArray|URL|string} source - Image source
   * @returns {Promise<ImageData>} Image data for analysis
   */
  async _loadImage(source) {
    try {
      // Create canvas for image processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let img;
      
      // Handle different input types
      if (source instanceof HTMLImageElement) {
        img = source;
      } else if (typeof source === 'string' || source instanceof URL) {
        // Load image from URL or path
        img = new Image();
        img.crossOrigin = 'Anonymous';
        
        // Create a promise to handle async image loading
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = source;
        });
      } else if (source instanceof ImageData || source instanceof Uint8ClampedArray) {
        // Return existing image data
        return source instanceof ImageData ? source : new ImageData(source, 1);
      } else {
        throw new Error('Unsupported image source');
      }
      
      // Resize large images for performance
      let width = img.width;
      let height = img.height;
      const totalPixels = width * height;
      
      if (totalPixels > this.MAX_SAMPLES) {
        const scale = Math.sqrt(this.MAX_SAMPLES / totalPixels);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      
      // Set canvas dimensions and draw the image
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get image data
      return ctx.getImageData(0, 0, width, height);
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  }

  /**
   * Extract statistical features from image data
   * @param {ImageData} imgData - Image data
   * @returns {Object} Features used for classification
   */
  _extractFeatures(imgData) {
    const { data, width, height } = imgData;
    const pixelCount = width * height;
    
    // Extract R, G, B channels
    const channels = [[], [], []];
    
    for (let i = 0; i < data.length; i += 4) {
      channels[0].push(data[i] / 255.0);     // R
      channels[1].push(data[i + 1] / 255.0); // G
      channels[2].push(data[i + 2] / 255.0); // B
    }
    
    const [r, g, b] = channels;
    
    // Calculate means
    const rMean = this._mean(r);
    const gMean = this._mean(g);
    const bMean = this._mean(b);
    
    // Calculate standard deviations
    const rStd = this._standardDeviation(r, rMean);
    const gStd = this._standardDeviation(g, gMean);
    const bStd = this._standardDeviation(b, bMean);
    
    // Calculate histograms (25 bins)
    const rHist = this._histogram(r, 25);
    const gHist = this._histogram(g, 25);
    const bHist = this._histogram(b, 25);
    
    // Calculate correlation between channels
    const rgCorr = this._correlation(r, g);
    const rbCorr = this._correlation(r, b);
    const gbCorr = this._correlation(g, b);
    
    // Calculate average correlation
    const avgCorrelation = (Math.abs(rgCorr) + Math.abs(rbCorr) + Math.abs(gbCorr)) / 3;
    
    // Calculate blue channel bias (common in normal maps)
    const blueHighRatio = b.filter(val => val > 0.8).length / b.length;
    
    // Check for normal map pattern (rgb around 0.5, 0.5, 1.0)
    let normalPatternCount = 0;
    for (let i = 0; i < pixelCount; i++) {
      const distSquared = Math.pow(r[i] - 0.5, 2) + Math.pow(g[i] - 0.5, 2) + Math.pow(b[i] - 1.0, 2);
      if (distSquared < 0.2) {
        normalPatternCount++;
      }
    }
    const normalPatternScore = normalPatternCount / pixelCount;
    
    // Check for normal vector validity
    let validNormalVectorsCount = 0;
    for (let i = 0; i < pixelCount; i++) {
      // Convert from [0,1] to [-1,1]
      const rx = r[i] * 2 - 1;
      const gy = g[i] * 2 - 1;
      const bz = b[i] * 2 - 1;
      
      // Calculate magnitude
      const magnitude = Math.sqrt(rx*rx + gy*gy + bz*bz);
      
      // Valid vectors should have magnitude close to 1
      if (magnitude > 0.5 && magnitude < 1.5) {
        validNormalVectorsCount++;
      }
    }
    const validNormalVectors = validNormalVectorsCount / pixelCount;
    
    // Calculate color variance
    const colorVariance = (rStd + gStd + bStd) / 3;
    
    // Calculate grayness (how close r,g,b values are to each other)
    let graynessSum = 0;
    for (let i = 0; i < pixelCount; i++) {
      graynessSum += Math.abs(r[i] - g[i]) + Math.abs(r[i] - b[i]) + Math.abs(g[i] - b[i]);
    }
    const grayness = 1.0 - (graynessSum / (2.0 * pixelCount));
    
    // Calculate entropy of each channel
    const rEntropy = this._entropy(rHist);
    const gEntropy = this._entropy(gHist);
    const bEntropy = this._entropy(bHist);
    const avgEntropy = (rEntropy + gEntropy + bEntropy) / 3;
    
    // Calculate channel independence
    const channelIndependence = 1.0 - avgCorrelation;
    
    // Check for metallicity pattern (common in ORM maps)
    const metallicPattern = b.filter(val => val < 0.12 || val > 0.88).length / b.length;
    
    // Estimate binary metallic score
    // This is simpler than the Laplacian in Python version but effective
    let edgeCount = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x);
        const center = b[idx];
        const left = b[idx - 1];
        const right = b[idx + 1];
        const up = b[idx - width];
        const down = b[idx + width];
        
        // Simple edge detection
        if (Math.abs(center - left) > 0.2 || 
            Math.abs(center - right) > 0.2 || 
            Math.abs(center - up) > 0.2 || 
            Math.abs(center - down) > 0.2) {
          edgeCount++;
        }
      }
    }
    const edgeRatio = edgeCount / (pixelCount * 0.25); // normalize
    const binaryMetallicScore = metallicPattern * (1.0 / (1 + edgeRatio));
    
    // Check for flat areas (common in roughness maps)
    let gradientSum = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x);
        const gx = Math.abs(g[idx + 1] - g[idx - 1]);
        const gy = Math.abs(g[idx + width] - g[idx - width]);
        gradientSum += gx + gy;
      }
    }
    const avgGradient = gradientSum / ((width - 2) * (height - 2) * 2);
    const roughnessPattern = 1.0 - Math.min(avgGradient * 10.0, 1.0);
    
    // Calculate overall flatness of colors
    const colorFlatness = 1.0 - Math.min(1.0, colorVariance * 4);
    
    // Calculate how similar the RGB distribution is to common texture types
    const rgbDistNormal = 1.0 - Math.sqrt(
      Math.pow(rMean - 0.5, 2) + 
      Math.pow(gMean - 0.5, 2) + 
      Math.pow(bMean - 1.0, 2)
    );
    
    // Assemble feature dictionary
    return {
      rMean,
      gMean,
      bMean,
      rStd,
      gStd,
      bStd,
      colorVariance,
      grayness,
      avgEntropy: avgEntropy,
      channelCorrelation: avgCorrelation,
      channelIndependence,
      blueChannelBias: blueHighRatio,
      rgbMeansNormal: rgbDistNormal,
      normalVectorValidity: validNormalVectors,
      binaryMetallicScore,
      roughnessPattern,
      colorFlatness,
      blueChannelAvg: bMean,
      rgbDistribution: 1 - Math.abs(rMean - gMean) - Math.abs(gMean - bMean) - Math.abs(rMean - bMean),
      normalPatternScore
    };
  }

  /**
   * Calculate scores for each texture type based on extracted features
   * @param {Object} features - Features extracted from the image
   * @returns {Object} Scores for each texture type
   */
  _calculateScores(features) {
    const scores = {};
    
    for (const [textureType, weights] of Object.entries(this.featureWeights)) {
      let score = 0.0;
      
      for (const [featureName, weight] of Object.entries(weights)) {
        if (featureName in features) {
          score += features[featureName] * weight;
        }
      }
      
      // Normalize to 0-1 range
      scores[textureType] = Math.max(0.0, Math.min(1.0, score));
    }
    
    return scores;
  }

  /**
   * Determine the final classification and confidence level
   * @param {Object} scores - Scores for each texture type
   * @returns {Array} [classification, confidence]
   */
  _determineClassification(scores) {
    // Find the texture type with the highest score
    let maxType = '';
    let maxScore = -1;
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }
    
    // Check if there's a clear winner
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    let scoreDiff = 0;
    
    if (sortedScores.length > 1) {
      scoreDiff = sortedScores[0] - sortedScores[1];
    }
    
    // Adjust confidence based on the score and difference from next best
    const baseConfidence = maxScore;
    const diffFactor = Math.min(scoreDiff * 3.0, 0.3);  // Max 0.3 boost from diff
    const confidence = Math.min(1.0, baseConfidence + diffFactor);
    
    // Determine if we should classify or return unknown
    if (confidence >= this.HIGH_CONFIDENCE) {
      return [maxType, confidence];
    } else if (confidence >= this.MEDIUM_CONFIDENCE) {
      return [maxType, confidence];
    } else if (confidence >= this.LOW_CONFIDENCE) {
      return [`likely_${maxType}`, confidence];
    } else {
      return ["unknown", confidence];
    }
  }
  
  /**
   * Calculate mean of an array
   * @param {Array<number>} arr - Input array
   * @returns {number} Mean value
   */
  _mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  /**
   * Calculate standard deviation of an array
   * @param {Array<number>} arr - Input array
   * @param {number} mean - Mean value (optional)
   * @returns {number} Standard deviation
   */
  _standardDeviation(arr, mean = null) {
    const mu = mean !== null ? mean : this._mean(arr);
    const squareDiffs = arr.map(value => Math.pow(value - mu, 2));
    return Math.sqrt(this._mean(squareDiffs));
  }
  
  /**
   * Calculate correlation between two arrays
   * @param {Array<number>} x - First array
   * @param {Array<number>} y - Second array
   * @returns {number} Correlation coefficient
   */
  _correlation(x, y) {
    const xMean = this._mean(x);
    const yMean = this._mean(y);
    let num = 0;
    let xSumSq = 0;
    let ySumSq = 0;
    
    for (let i = 0; i < x.length; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      num += xDiff * yDiff;
      xSumSq += xDiff * xDiff;
      ySumSq += yDiff * yDiff;
    }
    
    return num / (Math.sqrt(xSumSq) * Math.sqrt(ySumSq) || 1);
  }
  
  /**
   * Calculate histogram for an array
   * @param {Array<number>} arr - Input array
   * @param {number} bins - Number of bins
   * @returns {Array<number>} Histogram
   */
  _histogram(arr, bins) {
    const hist = new Array(bins).fill(0);
    const binSize = 1.0 / bins;
    
    for (const value of arr) {
      const binIndex = Math.min(Math.floor(value / binSize), bins - 1);
      hist[binIndex]++;
    }
    
    // Normalize
    return hist.map(h => h / arr.length);
  }
  
  /**
   * Calculate entropy from a histogram
   * @param {Array<number>} hist - Histogram
   * @returns {number} Entropy
   */
  _entropy(hist) {
    return -hist
      .filter(p => p > 0)
      .reduce((sum, p) => sum + p * Math.log2(p), 0);
  }
}

/**
 * Classify a list of atlas files and determine their texture types
 * @param {Array<string|HTMLImageElement|ImageData>} files - List of image sources
 * @param {Object} options - Options
 * @param {boolean} [options.verbose=false] - Whether to include detailed feature and score information
 * @param {string} [options.acceptableConfidence=null] - Override the global ACCEPTABLE_CONFIDENCE level
 * @returns {Promise<Object>} Classification results
 */
export async function classifyAtlasFiles(files, options = {}) {
  const classifier = new TextureClassifier();
  const { verbose = false, acceptableConfidence = null } = options;
  
  // Use the provided confidence level or fall back to the global constant
  const confidenceLevel = acceptableConfidence || ACCEPTABLE_CONFIDENCE;
  const minConfidenceThreshold = classifier.CONFIDENCE_THRESHOLDS[confidenceLevel];
  
  // Classify each file
  const fileClassifications = [];
  
  for (const fileSource of files) {
    let fileName = "";
    if (typeof fileSource === 'string') {
      // Extract filename from path or URL
      fileName = fileSource.split('/').pop().split('\\').pop();
    } else if (fileSource instanceof File) {
      fileName = fileSource.name;
    } else {
      fileName = "unnamed_texture";
    }
    
    const result = await classifier.classifyTexture(fileSource);
    result.file = fileName;
    result.path = fileSource;
    fileClassifications.push(result);
  }
  
  // Assign texture types based on classification results
  const bestMatches = {};
  const assignedFiles = new Set();
  
  // First pass: Assign high confidence matches
  for (const textureType of ['base_color', 'normal_map', 'orm_map']) {
    const candidates = fileClassifications.filter(res => 
      res.classification === textureType && 
      res.confidence >= classifier.HIGH_CONFIDENCE &&
      !assignedFiles.has(res.path)
    );
    
    if (candidates.length > 0) {
      // Sort by confidence
      candidates.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = candidates[0];
      bestMatches[textureType] = {
        file: bestMatch.file,
        path: bestMatch.path,
        confidence: bestMatch.confidence,
        confidenceLevel: 'high'
      };
      assignedFiles.add(bestMatch.path);
    }
  }
  
  // Second pass: Handle medium confidence matches if they meet the acceptable threshold
  if (minConfidenceThreshold <= classifier.MEDIUM_CONFIDENCE) {
    for (const textureType of ['base_color', 'normal_map', 'orm_map']) {
      if (textureType in bestMatches) continue;
      
      const candidates = fileClassifications.filter(res => 
        (res.classification === textureType || res.classification === `likely_${textureType}`) &&
        res.confidence >= classifier.MEDIUM_CONFIDENCE &&
        !assignedFiles.has(res.path)
      );
      
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.confidence - a.confidence);
        const bestMatch = candidates[0];
        bestMatches[textureType] = {
          file: bestMatch.file,
          path: bestMatch.path,
          confidence: bestMatch.confidence,
          confidenceLevel: 'medium',
          uncertain: true
        };
        assignedFiles.add(bestMatch.path);
      }
    }
  }
  
  // Third pass: Handle low confidence matches if they meet the acceptable threshold
  if (minConfidenceThreshold <= classifier.LOW_CONFIDENCE) {
    for (const textureType of ['base_color', 'normal_map', 'orm_map']) {
      if (textureType in bestMatches) continue;
      
      const candidates = fileClassifications.filter(res => 
        ((res.scores[textureType] || 0) >= classifier.LOW_CONFIDENCE) &&
        !assignedFiles.has(res.path)
      );
      
      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.scores[textureType] || 0) - (a.scores[textureType] || 0));
        const bestMatch = candidates[0];
        bestMatches[textureType] = {
          file: bestMatch.file,
          path: bestMatch.path,
          confidence: bestMatch.scores[textureType] || 0,
          confidenceLevel: 'low',
          bestGuess: true
        };
        assignedFiles.add(bestMatch.path);
      }
    }
  }
  
  // Handle remaining unassigned files as best guesses only if we're accepting UNKNOWN confidence
  if (minConfidenceThreshold <= classifier.UNKNOWN_CONFIDENCE) {
    const remainingFiles = fileClassifications.filter(res => !assignedFiles.has(res.path));
    
    for (const res of remainingFiles) {
      // Get the highest score texture type
      let maxType = '';
      let maxScore = -1;
      
      for (const [type, score] of Object.entries(res.scores)) {
        if (score > maxScore) {
          maxScore = score;
          maxType = type;
        }
      }
      
      if (maxType && !(maxType in bestMatches)) {
        bestMatches[maxType] = {
          file: res.file,
          path: res.path,
          confidence: res.scores[maxType],
          confidenceLevel: 'unknown',
          bestGuess: true
        };
      }
    }
  }
  
  // Mark missing texture types
  for (const missingType of ['base_color', 'normal_map', 'orm_map']) {
    if (!(missingType in bestMatches)) {
      bestMatches[missingType] = {
        file: null,
        path: null,
        confidence: 0.0,
        missing: true
      };
    }
  }
  
  // Prepare the final result
  const results = {
    textureAssignments: bestMatches,
    acceptableConfidenceLevel: confidenceLevel,
    summary: {
      baseColor: bestMatches['base_color'].file || "No file",
      normalMap: bestMatches['normal_map'].file || "No file",
      ormMap: bestMatches['orm_map'].file || "No file"
    }
  };
  
  if (verbose) {
    results.detailedClassifications = fileClassifications;
  }
  
  return results;
}

/**
 * Set the global acceptable confidence level
 * @param {string} level - Confidence level ('high', 'medium', 'low', 'unknown')
 */
export function setAcceptableConfidence(level) {
  if (Object.values(ConfidenceLevel).includes(level)) {
    ACCEPTABLE_CONFIDENCE = level;
  } else {
    throw new Error(`Invalid confidence level: ${level}. Must be one of: high, medium, low, unknown`);
  }
} 