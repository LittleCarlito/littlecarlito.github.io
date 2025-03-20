/**
 * Detailed Test Reporter for Jest
 * 
 * Provides a more detailed output of test results, including exactly which tests passed and failed.
 */

/**
 *
 */
class DetailedReporter {
	/**
	 *
	 */
	constructor(globalConfig, options) {
		this._globalConfig = globalConfig;
		this._options = options;
		this.passed = 0;
		this.failed = 0;
		this.pending = 0;
		this.skipped = 0;
		this.testDetails = [];
		this.failedTestSuites = [];
	}

	/**
	 *
	 */
	onTestStart(test) {
		// Track test starts
	}

	/**
	 *
	 */
	onTestResult(test, testResult, aggregatedResult) {
		// Track test suite failures
		if (testResult.failureMessage) {
			this.failedTestSuites.push({
				file: testResult.testFilePath,
				message: testResult.failureMessage
			});
		}

		// Count results
		testResult.testResults.forEach(result => {
			if (result.status === 'passed') {
				this.passed++;
			} else if (result.status === 'failed') {
				this.failed++;
			} else if (result.status === 'pending') {
				this.pending++;
			} else if (result.status === 'skipped') {
				this.skipped++;
			}

			// Add to detailed results
			this.testDetails.push({
				file: testResult.testFilePath,
				title: result.fullName || result.title,
				status: result.status,
				duration: result.duration || 0,
				failureMessages: result.failureMessages || []
			});
		});
	}

	/**
	 *
	 */
	onRunComplete(contexts, results) {
		// Print a fancy header
		console.log('\n' + '='.repeat(60));
		console.log('🧪 DETAILED TEST REPORT 🧪'.padStart(40));
		console.log('='.repeat(60));
    
		// Print summary stats with fancy formatting
		console.log('\n📊 SUMMARY');
		console.log('━━━━━━━━━━');
		console.log(`📁 Test Files   : ${results.numPassedTestSuites} passed, ${results.numFailedTestSuites} failed, ${results.numTotalTestSuites} total`);
		console.log(`🧪 Test Cases   : ${this.passed + this.failed + this.pending + this.skipped} total`);
		console.log(`✅ Passed Tests : ${this.passed}`);
		console.log(`❌ Failed Tests : ${this.failed}`);
		console.log(`⏳ Pending Tests: ${this.pending}`);
		console.log(`⏭️ Skipped Tests: ${this.skipped}`);
		console.log(`⏱️ Duration     : ${results.startTime ? Math.round((Date.now() - results.startTime) / 100) / 10 + 's' : 'unknown'}`);
    
		// Failed Test Suites
		if (this.failedTestSuites.length > 0) {
			console.log('\n' + '='.repeat(60));
			console.log('❌ FAILED TEST SUITES'.padStart(40));
			console.log('='.repeat(60));
      
			this.failedTestSuites.forEach((suite, index) => {
				const fileName = suite.file.split('/').pop();
				console.log(`\n${index + 1}) ${fileName} ❌`);
        
				// Extract and display error message more clearly
				let errorLines = suite.message.split('\n');
				let errorMessage = '';
        
				if (errorLines.length > 0) {
					// First line is usually the main error message
					errorMessage = errorLines[0].trim();
          
					// Find the actual error message - look for lines with "Error:" or similar
					const detailedErrorLine = errorLines.find(line => 
						line.includes('Error:') || 
            line.includes('Cannot find module') || 
            line.includes('SyntaxError:')
					);
          
					if (detailedErrorLine) {
						errorMessage = detailedErrorLine.trim();
					}
          
					console.log(`   🛑 ${errorMessage}`);
          
					// If there's a stack trace or more details, show the relevant parts
					const stackTraceLine = errorLines.find(line => 
						line.includes('at ') && 
            (line.includes(fileName) || line.includes('tests/'))
					);
          
					if (stackTraceLine) {
						console.log(`   📍 ${stackTraceLine.trim()}`);
					}
				}
			});
		}
    
		// Failed Tests
		if (this.failed > 0) {
			console.log('\n' + '='.repeat(60));
			console.log('❌ FAILED TESTS'.padStart(40));
			console.log('='.repeat(60));
      
			this.testDetails
				.filter(test => test.status === 'failed')
				.forEach((test, index) => {
					const fileName = test.file.split('/').pop();
					console.log(`\n${index + 1}) ${test.title} ❌ [${fileName}]`);
          
					if (test.failureMessages && test.failureMessages.length > 0) {
						const errorMessage = test.failureMessages[0].split('\n')[0].trim();
						console.log(`   🛑 ${errorMessage}`);
					}
				});
		}
    
		// Passed Tests
		console.log('\n' + '='.repeat(60));
		console.log('✅ PASSED TESTS'.padStart(40));
		console.log('='.repeat(60));
    
		this.testDetails
			.filter(test => test.status === 'passed')
			.forEach((test, index) => {
				const fileName = test.file.split('/').pop();
				console.log(`${index + 1}) ${test.title} [${fileName}]`);
			});
      
		console.log('\n' + '='.repeat(60));
	}
}

export default DetailedReporter; 