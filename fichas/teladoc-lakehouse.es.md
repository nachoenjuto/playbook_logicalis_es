---
publicar: false  # ejemplo inventado del catálogo original, no es un caso real
id: teladoc-lakehouse
lang: es
title: Plataforma Lakehouse para Analítica Clínica e Interoperabilidad Hospitalaria
cliente_display: Grupo Hospitalario Internacional
cliente_publico: false
sector: Salud
tecnologia:
- Azure
- Snowflake
- Python
tipo_proyecto: Plataforma
importe_label: Plataforma
anio: 2025
partner:
- Microsoft
- Databricks
bu: Data & AI
tags:
- lakehouse
- salud
- interoperabilidad
- datos clínicos
briefing: El cliente gestiona una red distribuida de centros hospitalarios y telemedicina
  con millones de registros de pacientes. Los datos asistenciales residían en silos
  heterogéneos (sistemas HIS legacy, bases relacionales y almacenes documentales),
  imposibilitando la generación de analítica en tiempo casi real y dificultando el
  cumplimiento de normativas de interoperabilidad sanitaria. El reto principal consistía
  en unificar la información bajo una arquitectura escalable, segura y gobernada que
  permitiese tanto la explotación analítica tradicional como el entrenamiento futuro
  de modelos predictivos clínicos, preservando estrictos protocolos de anonimización
  de datos de pacientes.
---

## 1. Contexto y Reto de Negocio

El cliente gestiona una red distribuida de centros hospitalarios y telemedicina con millones de registros de pacientes. Los datos asistenciales residían en silos heterogéneos (sistemas HIS legacy, bases relacionales y almacenes documentales), imposibilitando la generación de analítica en tiempo casi real y dificultando el cumplimiento de normativas de interoperabilidad sanitaria.

El reto principal consistía en unificar la información bajo una arquitectura escalable, segura y gobernada que permitiese tanto la explotación analítica tradicional como el entrenamiento futuro de modelos predictivos clínicos, preservando estrictos protocolos de anonimización de datos de pacientes.

## 2. Solución Arquitectónica

Logicalis diseñó e implantó una plataforma Lakehouse moderna sobre **Microsoft Azure** y **Databricks**, fundamentada en el patrón de arquitectura Medallion (Bronce, Plata y Oro):

- **Capa Bronce (Ingesta cruda)**: Ingesta automatizada de eventos clínicos y registros HL7/FHIR en streaming y micro-batch mediante Azure Data Factory y Databricks Autoloader.
- **Capa Plata (Calidad y Normalización)**: Transformaciones con PySpark aplicando reglas de calidad, deduplicación y enmascaramiento criptográfico de identificadores de pacientes (PII).
- **Capa Oro (Dominio y Modelado)**: Tablas agregadas en formato Delta Lake optimizadas para consultas de gestión hospitalaria y soporte a la decisión clínica.
- **Gobernanza Unificada**: Control de acceso granular por rol y linaje de datos de extremo a extremo mediante Unity Catalog.

## 3. Resultados y Valor Entregado

- **Reducción del 70% en tiempos de consulta** sobre históricos clínicos agregados.
- **Interoperabilidad completa** entre sistemas de telemedicina y centros hospitalarios presenciales.
- **Autonomía analítica** para equipos médicos y de operaciones mediante cuadros de mando en tiempo real.
- **Cumplimiento normativo integral** (RGPD y ENS nivel Alto) gracias a la gobernanza centralizada.
