const {identity, isFunction} = require('lodash');
const pReflect = require('p-reflect');
const pReduce = require('p-reduce');
const AggregateError = require('aggregate-error');

/**
 * A Function that execute a list of function sequencially. If at least one Function ins the pipeline throw an Error or rejects, the pipeline function rejects as well.
 *
 * @typedef {Function} Pipeline
 * @param {[type]} input Argument to pass to the first step in the pipeline.
 * @param {Boolean} [settleAll=false] If `true` all the steps in the pipeline are executed, even if one rejects, if `false` the execution stops after a steps rejects.
 * @param {Function} [getNextInput=identity] Function called after each step is executed, with the last and current step results; the returned value will be used as the argument of the next step.
 * @param {Function} [transform=identity] Function called after each step is executed, with the current step result and the step function; the returned value will be saved in the pipeline results.
 *
 * @return {Array<*>|*} An Array with the result of each step in the pipeline; if there is only 1 step in the pipeline, the result of this step is returned directly.
 *
 * @throws {AggregateError|Error} An AggregateError with the errors of each step in the pipeline that rejected; if there is only 1 step in the pipeline, the error of this step is thrown directly.
 */

/**
 * Create a Pipeline with a list of Functions.
 *
 * @param {Array<Function>} steps The list of Function to execute.
 * @return {Pipeline} A Function that execute the `steps` sequencially
 */
module.exports = steps => async (input, settleAll = false, getNextInput = identity, transform = identity) => {
  const results = [];
  const errors = [];
  await pReduce(
    steps,
    async (lastResult, step) => {
      let result;

      // Call the step with the input computed at the end of the previous iteration and save intermediary result
      if (settleAll) {
        const {isFulfilled, value, reason} = await pReflect(step(lastResult));
        result = isFulfilled ? value : reason;
        if (isFulfilled) {
          results.push(result);
        } else {
          errors.push(...(result && isFunction(result[Symbol.iterator]) ? result : [result]));
        }
      } else {
        result = await transform(await step(lastResult), step);
        results.push(result);
      }
      // Prepare input for the next step, passing the result of the last iteration (or initial parameter for the first iteration) and the current one
      return getNextInput(lastResult, result);
    },
    input
  );
  if (errors.length > 0) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors);
  }
  return results.length <= 1 ? results[0] : results;
};
