FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/invoiceflow.conf
COPY invoiceflow-pro.html /usr/share/nginx/html/index.html
COPY data/ /usr/share/nginx/html/data/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
