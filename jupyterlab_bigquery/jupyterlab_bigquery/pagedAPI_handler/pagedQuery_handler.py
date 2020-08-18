from jupyterlab_bigquery.pagedAPI_handler import PagedAPIHandler
from google.cloud import bigquery
import json
from jupyterlab_bigquery.details_handler import format_preview_fields, format_preview_rows, parallel_format_preview_rows
from google.cloud.bigquery.dbapi import _helpers
from threading import Lock
from time import time

from multiprocessing import Pool

SUPPORTED_JOB_CONFIG_FLAGS = [
    'maximum_bytes_billed', 'use_legacy_sql', 'project', 'params'
]

NUM_THREADS = 6

class PagedQueryHandler(PagedAPIHandler):
  client = None
  client_lock = Lock()
  orig_project = None

  def __init__(self, application, request, **kwargs):
    super().__init__(application, request, **kwargs)

    self.pool = Pool(NUM_THREADS)

    if PagedQueryHandler.client is None:
      PagedQueryHandler.client = bigquery.Client()
      PagedQueryHandler.orig_project = PagedQueryHandler.client.project

  def query(self, request_body, page_size):
    start = time()
    query = request_body['query']
    jobConfig = request_body['jobConfig']
    dryRunOnly = request_body['dryRunOnly']

    # process flags
    processed_flags = {
        support_flag: jobConfig[support_flag]
        for support_flag in SUPPORTED_JOB_CONFIG_FLAGS
        if support_flag in jobConfig
    }

    if 'params' in processed_flags:
      processed_flags['query_parameters'] = _helpers.to_query_parameters(
          processed_flags['params'])

    if 'maximum_bytes_billed' in processed_flags and\
      processed_flags['maximum_bytes_billed'] is None:
      del processed_flags['maximum_bytes_billed']

    if 'use_legacy_sql' in processed_flags and\
      not isinstance(processed_flags['use_legacy_sql'], bool):
      raise ValueError(
          'use_legacy_sql shoud be boolean, instead received {}'.format(
              processed_flags['use_legacy_sql']))

    print('A', str(time() - start))
    start = time()

    # dry run, will throw exception if fail
    dry_run_job_config = bigquery.QueryJobConfig(**processed_flags)
    dry_run_job_config.dry_run = True
    dry_run_job_config.use_query_cache = False

    try:
      with PagedQueryHandler.client_lock:
        if 'project' in jobConfig and jobConfig['project'] is not None:
          PagedQueryHandler.client.project = jobConfig['project']
        else:
          PagedQueryHandler.client.project = PagedQueryHandler.orig_project
        dry_run_job = PagedQueryHandler.client.query(
            query, job_config=dry_run_job_config)
        PagedQueryHandler.client.project = PagedQueryHandler.orig_project
    except Exception as err:
      if hasattr(err, 'errors'):
        raise Exception(err.errors[0]['message'])
      else:
        raise Exception(err)
    total_bytes_processed = dry_run_job.total_bytes_processed

    if dryRunOnly:
      job_id = 'dry_run' if dry_run_job.job_id is None else  dry_run_job.job_id
      yield dry_run_job, job_id
      yield {
        'content': json.dumps(None),
        'labels': json.dumps(None),
        'bytesProcessed': json.dumps(total_bytes_processed)
      }
      return


    print('B', str(time() - start))
    start = time()

    # actual run
    job_config = bigquery.QueryJobConfig(**processed_flags)

    print('C-1', str(time() - start))
    start = time()

    # need synchronization since all query handler share the same client
    with PagedQueryHandler.client_lock:
      if 'project' in jobConfig and jobConfig['project'] is not None:
        PagedQueryHandler.client.project = jobConfig['project']
      else:
        PagedQueryHandler.client.project = PagedQueryHandler.orig_project
      query_job = PagedQueryHandler.client.query(query, job_config=job_config)
      PagedQueryHandler.client.project = PagedQueryHandler.orig_project


    print('C-2', str(time() - start))
    start = time()

    if query_job.error_result is not None:
      raise Exception(query_job.error_result)

    yield query_job, query_job.job_id

    # send contents
    en = query_job.result(page_size)
    print('C-3', str(time() - start))
    start = time()
    schema_fields = format_preview_fields(en.schema)

    print('C-4', str(time() - start))
    start = time()


    start_fetch = time()
    for page in en.pages:
      print('FETCH', str(time() - start_fetch))
      start = time()

      if page.num_items > 2e5:
        content = parallel_format_preview_rows(page, en.schema, pool=self.pool)
      else:
        content = format_preview_rows(page, en.schema)

      print('D', str(time() - start))
      start = time()

      response = {
          'content': json.dumps(content),
          'labels': json.dumps(schema_fields),
          'bytesProcessed': json.dumps(total_bytes_processed),
          'project': json.dumps(query_job.project),
      }
      print('E', str(time() - start))
      yield response
      start_fetch = time()

  def cancel(self, job):
    job.cancel()
    job.cancel()
