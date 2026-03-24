# Prompt Documentation

This is a dummy template for documenting AI usage in this repository.

Use it as a format guide and replace the sample entries with your own prompts if needed.

## Prompt #1 - Model Selection or Comparison

Tool used: ChatGPT

Prompt sent:

> Compare logistic regression, random forest, and XGBoost for a fraud detection use case. Focus on tradeoffs for noisy tabular data.

What it gave:

- A high-level comparison of the three model families.
- Guidance that tree-based boosting methods usually handle tabular fraud data better than simple linear baselines.

What we changed:

- Kept the comparison as background only.
- Chose the model option that fit the project constraints and available features.

Limitation noted:

- The response was generic and did not know the actual dataset shape or class imbalance.

## Prompt #2 - Training or Feature Engineering

Tool used: ChatGPT

Prompt sent:

> Suggest feature engineering ideas for a transaction fraud model using amount, timestamp, device, location, and user history fields.

What it gave:

- Ideas such as amount deviation, transaction frequency, odd-hour activity, device novelty, and location mismatch.
- A few suggestions for encoding categorical behavior signals.

What we changed:

- Kept only the features that matched the dataset and pipeline.
- Dropped ideas that depended on missing columns or extra external data.

Limitation noted:

- The response could not guarantee which features would survive cleaning or schema validation.

## Prompt #3 - Evaluation Metrics and Tuning

Tool used: ChatGPT

Prompt sent:

> What metrics and tuning strategy should I use to evaluate a fraud detection model when false positives are costly but false negatives are also risky?

What it gave:

- A recommendation to look at precision, recall, F1, ROC-AUC, and threshold-based metrics.
- Suggestions for tuning the decision threshold rather than relying only on default class predictions.

What we changed:

- Prioritized the metrics that aligned with the project's fraud-reporting workflow.
- Kept the threshold discussion practical and focused on analyst review.

Limitation noted:

- The advice was generic and did not account for the project's exact operating cost tradeoffs.

## Prompt #4 - Handling Class Imbalance

Tool used: ChatGPT

Prompt sent:

> How should I handle class imbalance in a fraud dataset without making the model overfit to the minority class?

What it gave:

- Suggestions like class weights, balanced sampling, and threshold tuning.
- A warning about being careful with oversampling on small datasets.

What we changed:

- Kept the imbalance strategy lightweight.
- Preferred methods that fit the current pipeline instead of adding heavy preprocessing.

Limitation noted:

- The response did not know the exact minority-class ratio or label noise level.

## Prompt #5 - Validation Strategy

Tool used: ChatGPT

Prompt sent:

> Recommend a validation strategy for a fraud model when transactions are time-based and may have temporal leakage.

What it gave:

- Advice to use time-based train-test splits instead of random splits.
- A recommendation to preserve ordering when simulating production behavior.

What we changed:

- Followed the time-aware validation idea.
- Avoided random shuffling where it could leak future information.

Limitation noted:

- The response could not determine whether the dataset had enough history for multiple time windows.

## Prompt #6 - Model Interpretability

Tool used: ChatGPT

Prompt sent:

> Suggest simple ways to explain fraud model predictions to analysts and non-technical users.

What it gave:

- Ideas like feature importance summaries, score bands, and plain-language reason codes.
- A suggestion to pair numeric scores with short explanations.

What we changed:

- Kept the explanation format concise and analyst-friendly.
- Avoided adding explanations that would be too technical for the UI.

Limitation noted:

- The response was not tailored to the exact explanation components already present in the app.

## Prompt #7 - Threshold Calibration

Tool used: ChatGPT

Prompt sent:

> How can I choose a fraud probability threshold that balances catching suspicious cases with keeping analyst workload manageable?

What it gave:

- Guidance to inspect precision-recall tradeoffs at different thresholds.
- A suggestion to choose a threshold based on operational capacity.

What we changed:

- Treated the threshold as a business decision, not just a statistical one.
- Kept the threshold selection tied to report volume and review effort.

Limitation noted:

- The recommendation depended on workflow capacity that the model cannot infer automatically.

## Prompt #8 - Feature Importance Review

Tool used: ChatGPT

Prompt sent:

> Help me review whether the engineered features actually make sense for fraud detection before training the model.

What it gave:

- A checklist for checking whether features are stable, explainable, and available at inference time.
- Advice to remove features that leak the target or duplicate information.

What we changed:

- Used the checklist as a review step before finalizing the feature set.
- Removed features that looked redundant or too dependent on future information.

Limitation noted:

- The response could not verify the real dataset columns without seeing the data.
