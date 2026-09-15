FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

# Copy site source files
COPY src/ /usr/share/nginx/html/

# Cloud Run requires the container to listen on $PORT (default 8080)
# nginx.conf is configured to use this
EXPOSE 8080

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
