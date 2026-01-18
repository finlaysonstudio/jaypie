FROM public.ecr.aws/lambda/nodejs:24

# Copy built adapter and test handler
COPY dist/ ${LAMBDA_TASK_ROOT}/dist/
COPY docker/handler.mjs ${LAMBDA_TASK_ROOT}/

# Install dependencies (express is in devDeps but needed for test handler)
COPY package.json ${LAMBDA_TASK_ROOT}/
RUN npm install --omit=dev && npm install express

CMD ["handler.handler"]
