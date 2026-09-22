---
publicar: false  # ejemplo inventado del catálogo original, no es un caso real
id: banco-fraude-ml
lang: es
title: Sistema de Detección de Fraude en Tiempo Real con Modelos de Machine Learning
cliente_display: Entidad Bancaria IBEX
cliente_publico: false
sector: Banca y Finanzas
tecnologia:
- AWS
- Python
- Kubernetes
tipo_proyecto: Vertical
importe_label: Vertical
anio: 2024
partner:
- AWS
bu: Data & AI
tags:
- machine learning
- fraude
- streaming
- tiempo real
briefing: Una de las principales entidades bancarias del IBEX 35 requería modernizar
  sus mecanismos de prevención de fraude transaccional en canales de pago digital
  y banca móvil. Los sistemas basados exclusivamente en motores de reglas estáticas
  generaban una tasa excesiva de falsos positivos, afectando negativamente la experiencia
  de usuario de clientes legítimos y dilatando el tiempo de respuesta ante nuevos
  patrones de ciberestafa. El objetivo fue desplegar una infraestructura de inferencia
  en tiempo real capaz de evaluar miles de transacciones por segundo con una latencia
  inferior a 50 milisegundos.
---

## 1. Contexto y Reto de Negocio

Una de las principales entidades bancarias del IBEX 35 requería modernizar sus mecanismos de prevención de fraude transaccional en canales de pago digital y banca móvil. Los sistemas basados exclusivamente en motores de reglas estáticas generaban una tasa excesiva de falsos positivos, afectando negativamente la experiencia de usuario de clientes legítimos y dilatando el tiempo de respuesta ante nuevos patrones de ciberestafa.

El objetivo fue desplegar una infraestructura de inferencia en tiempo real capaz de evaluar miles de transacciones por segundo con una latencia inferior a 50 milisegundos.

## 2. Solución Técnica

Logicalis desarrolló un pipeline de analítica predictiva de alta disponibilidad sobre **Amazon Web Services (AWS)**:

- **Ingesta de eventos transaccionales**: Arquitectura desacoplada basada en colas gestionadas y procesamiento distribuido de eventos en streaming.
- **Inferencia en tiempo real**: Modelos de detección de anomalías (árboles de decisión y redes neuronales) empaquetados en contenedores sobre **Amazon EKS (Kubernetes)** con autoescalado elástico.
- **Feature Store centralizado**: Almacén de variables de comportamiento de clientes en baja latencia para enriquecer las transacciones en vuelo.
- **Monitoreo de Drift**: Auditoría continua de desviación de modelo (data drift / concept drift) para reentrenamiento automático.

## 3. Resultados y Valor Entregado

- **Reducción del 45% en pérdidas brutas por transacciones fraudulentas**.
- **Disminución del 60% en falsos positivos**, mejorando notablemente la satisfacción y conversión en pagos digitales.
- **Latencia media de inferencia de 28 ms**, muy por debajo del SLA crítico exigido de 50 ms.
