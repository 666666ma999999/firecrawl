import pytest
from firecrawl.v2.types import (
    JsonFormat,
    ScrapeOptions,
    PDFParser,
    CrawlRequest,
    MapOptions,
    ExtractRequest,
    SearchRequest,
    BatchScrapeRequest,
)
from firecrawl.v2.utils.validation import (
    validate_scrape_options,
    prepare_scrape_options,
    detect_camel_case_keys,
    convert_camel_to_snake_keys,
    CAMEL_TO_SNAKE_MAPPINGS,
)


class TestValidateScrapeOptions:
    """Unit tests for validate_scrape_options function."""

    def test_validate_none_options(self):
        """Test validation with None options."""
        result = validate_scrape_options(None)
        assert result is None

    def test_validate_valid_options(self):
        """Test validation with valid options."""
        options = ScrapeOptions(
            formats=["markdown"],
            timeout=30000,
            wait_for=2000
        )
        result = validate_scrape_options(options)
        assert result == options

    def test_validate_invalid_timeout(self):
        """Test validation with invalid timeout."""
        options = ScrapeOptions(timeout=0)
        with pytest.raises(ValueError, match="Timeout must be positive"):
            validate_scrape_options(options)

    def test_validate_negative_timeout(self):
        """Test validation with negative timeout."""
        options = ScrapeOptions(timeout=-1000)
        with pytest.raises(ValueError, match="Timeout must be positive"):
            validate_scrape_options(options)

    def test_validate_invalid_wait_for(self):
        """Test validation with invalid wait_for."""
        options = ScrapeOptions(wait_for=-500)
        with pytest.raises(ValueError, match="wait_for must be non-negative"):
            validate_scrape_options(options)

    def test_validate_zero_wait_for(self):
        """Test validation with zero wait_for (should be valid)."""
        options = ScrapeOptions(wait_for=0)
        result = validate_scrape_options(options)
        assert result == options

    def test_validate_complex_options(self):
        """Test validation with complex options."""
        options = ScrapeOptions(
            formats=["markdown", "html"],
            headers={"User-Agent": "Test"},
            include_tags=["h1", "h2"],
            exclude_tags=["nav"],
            only_main_content=False,
            timeout=15000,
            wait_for=2000,
            mobile=True,
            skip_tls_verification=True,
            remove_base64_images=False,
            raw_html=True,
            screenshot_full_page=True
        )
        result = validate_scrape_options(options)
        assert result == options

    def test_validate_multiple_invalid_fields(self):
        """Test validation with multiple invalid fields."""
        options = ScrapeOptions(timeout=-1000, wait_for=-500)
        with pytest.raises(ValueError, match="Timeout must be positive"):
            validate_scrape_options(options)
        # Should fail on first invalid field (timeout)

    def test_validate_edge_cases(self):
        """Test validation with edge case values."""
        # Test with very large timeout
        options = ScrapeOptions(timeout=999999)
        result = validate_scrape_options(options)
        assert result == options

        # Test with very large wait_for
        options = ScrapeOptions(wait_for=999999)
        result = validate_scrape_options(options)
        assert result == options


class TestPrepareScrapeOptions:
    """Unit tests for prepare_scrape_options function."""

    def test_prepare_none_options(self):
        """Test preparation with None options."""
        result = prepare_scrape_options(None)
        assert result is None

    def test_prepare_basic_options(self):
        """Test preparation with basic options."""
        options = ScrapeOptions(
            formats=["markdown"],
            timeout=30000,
            wait_for=2000
        )
        result = prepare_scrape_options(options)
        
        assert isinstance(result, dict)
        assert "formats" in result
        assert "timeout" in result
        assert "waitFor" in result
        assert result["timeout"] == 30000
        assert result["waitFor"] == 2000

    def test_prepare_snake_case_conversion(self):
        """Test snake_case to camelCase conversion."""
        options = ScrapeOptions(
            include_tags=["h1", "h2"],
            exclude_tags=["nav"],
            only_main_content=False,
            wait_for=2000,
            skip_tls_verification=True,
            remove_base64_images=False
            # Note: raw_html should be in formats array, not as a separate field
        )
        result = prepare_scrape_options(options)
    
        # Check conversions
        assert "includeTags" in result
        assert result["includeTags"] == ["h1", "h2"]
        assert "excludeTags" in result
        assert result["excludeTags"] == ["nav"]
        assert "onlyMainContent" in result
        assert result["onlyMainContent"] is False
        assert "waitFor" in result
        assert result["waitFor"] == 2000
        assert "skipTlsVerification" in result
        assert result["skipTlsVerification"] is True
        assert "removeBase64Images" in result
        assert result["removeBase64Images"] is False
        
        # Check that snake_case fields are not present
        assert "include_tags" not in result
        assert "exclude_tags" not in result
        assert "only_main_content" not in result
        assert "wait_for" not in result
        assert "skip_tls_verification" not in result
        assert "remove_base64_images" not in result

    def test_prepare_complex_options(self):
        """Test preparation with complex options."""
        options = ScrapeOptions(
            formats=["markdown", "html", "rawHtml"],
            headers={"User-Agent": "Test Bot"},
            include_tags=["h1", "h2", "h3"],
            exclude_tags=["nav", "footer"],
            only_main_content=False,
            timeout=15000,
            wait_for=2000,
            mobile=True,
            skip_tls_verification=True,
            remove_base64_images=False
        )
        result = prepare_scrape_options(options)
        
        # Check all fields are present and converted
        assert "formats" in result
        assert "headers" in result
        assert "includeTags" in result
        assert "excludeTags" in result
        assert "onlyMainContent" in result
        assert "timeout" in result
        assert "waitFor" in result
        assert "mobile" in result
        assert "skipTlsVerification" in result
        assert "removeBase64Images" in result
        
        # Check values
        assert result["formats"] == ["markdown", "html", "rawHtml"]
        assert result["headers"] == {"User-Agent": "Test Bot"}
        assert result["includeTags"] == ["h1", "h2", "h3"]
        assert result["excludeTags"] == ["nav", "footer"]
        assert result["onlyMainContent"] is False
        assert result["timeout"] == 15000
        assert result["waitFor"] == 2000
        assert result["mobile"] is True
        assert result["skipTlsVerification"] is True
        assert result["removeBase64Images"] is False

    def test_prepare_invalid_options(self):
        """Test preparation with invalid options (should raise error)."""
        options = ScrapeOptions(timeout=-1000)
        with pytest.raises(ValueError, match="Timeout must be positive"):
            prepare_scrape_options(options)

    def test_prepare_empty_options(self):
        """Test preparation with empty options."""
        options = ScrapeOptions()  # All defaults
        result = prepare_scrape_options(options)
        
        # Should return dict with default values
        assert isinstance(result, dict)
        assert "onlyMainContent" in result
        assert result["onlyMainContent"] is True
        assert "mobile" in result
        assert result["mobile"] is False

    def test_prepare_none_values(self):
        """Test preparation with None values in options."""
        options = ScrapeOptions(
            formats=None,
            timeout=None,
            wait_for=None,
            include_tags=None,
            exclude_tags=None
        )
        result = prepare_scrape_options(options)
        
        # Should only include non-None values
        assert isinstance(result, dict)
        # Should have default values for required fields
        assert "onlyMainContent" in result
        assert "mobile" in result 

    def test_format_schema_conversion(self):
        """Test that Format schema is properly handled."""
        # Create a JsonFormat object with schema
        format_obj = JsonFormat(
            type="json",
            prompt="Extract product info",
            schema={"type": "object", "properties": {"name": {"type": "string"}}}
        )
        
        dumped = format_obj.model_dump()
        assert "schema" in dumped
        assert dumped["schema"] == {"type": "object", "properties": {"name": {"type": "string"}}} 

    def test_prepare_new_v2_fields(self):
        """Test preparation with new v2 fields."""
        from firecrawl.v2.types import Viewport, ScreenshotAction
        
        viewport = Viewport(width=1920, height=1080)
        screenshot_action = ScreenshotAction(
            type="screenshot",
            full_page=True,
            quality=90,
            viewport=viewport
        )
        
        options = ScrapeOptions(
            fast_mode=True,
            use_mock="test-mock",
            block_ads=False,
            store_in_cache=False,
            max_age=7200000,  # 2 hours
            actions=[screenshot_action],
            parsers=["pdf"]
        )
        
        result = prepare_scrape_options(options)
        
        # Check new field conversions
        assert "fastMode" in result
        assert result["fastMode"] is True
        assert "useMock" in result
        assert result["useMock"] == "test-mock"
        assert "blockAds" in result
        assert result["blockAds"] is False
        assert "storeInCache" in result
        assert result["storeInCache"] is False
        assert "maxAge" in result
        assert result["maxAge"] == 7200000
        
        # Check actions conversion
        assert "actions" in result
        assert len(result["actions"]) == 1
        action = result["actions"][0]
        assert action["type"] == "screenshot"
        assert action["fullPage"] is True
        assert action["quality"] == 90
        assert "viewport" in action
        assert action["viewport"]["width"] == 1920
        assert action["viewport"]["height"] == 1080
        
        # Check parsers
        assert "parsers" in result
        assert result["parsers"] == ["pdf"]
        
        # Check that snake_case fields are not present
        assert "fast_mode" not in result
        assert "use_mock" not in result
        assert "block_ads" not in result
        assert "store_in_cache" not in result
        assert "max_age" not in result 

    def test_prepare_parsers_max_pages_dict(self):
        """Ensure parser dicts convert max_pages to maxPages."""
        options = ScrapeOptions(
            parsers=[{"type": "pdf", "max_pages": 3}]
        )

        result = prepare_scrape_options(options)

        assert "parsers" in result
        assert result["parsers"][0]["maxPages"] == 3
        assert "max_pages" not in result["parsers"][0]

    def test_prepare_parsers_max_pages_model(self):
        """Ensure parser models convert max_pages to maxPages."""
        parser = PDFParser(max_pages=5)
        options = ScrapeOptions(parsers=[parser])

        result = prepare_scrape_options(options)

        assert result["parsers"][0]["maxPages"] == 5


class TestCamelCaseConversion:
    """Unit tests for camelCase to snake_case conversion utilities."""

    def test_detect_known_camel_case_keys(self):
        """Test detection of known camelCase keys."""
        data = {"includeTags": ["h1"], "onlyMainContent": True}
        issues = detect_camel_case_keys(data)

        assert len(issues) == 2
        assert ("includeTags", "include_tags") in issues
        assert ("onlyMainContent", "only_main_content") in issues

    def test_detect_unknown_camel_case_keys(self):
        """Test detection of unknown camelCase keys."""
        data = {"someNewField": "value", "anotherCamelCase": 123}
        issues = detect_camel_case_keys(data)

        assert len(issues) == 2
        # Should convert to snake_case even if not in mapping
        assert ("someNewField", "some_new_field") in issues
        assert ("anotherCamelCase", "another_camel_case") in issues

    def test_no_camel_case_detected_for_snake_case(self):
        """Test that snake_case keys are not flagged."""
        data = {"include_tags": ["h1"], "only_main_content": True}
        issues = detect_camel_case_keys(data)

        assert len(issues) == 0

    def test_convert_camel_to_snake_keys(self):
        """Test conversion of camelCase keys to snake_case."""
        data = {
            "includeTags": ["h1", "h2"],
            "onlyMainContent": True,
            "maxAge": 5000,
        }
        result = convert_camel_to_snake_keys(data)

        assert "include_tags" in result
        assert "only_main_content" in result
        assert "max_age" in result
        assert result["include_tags"] == ["h1", "h2"]
        assert result["only_main_content"] is True
        assert result["max_age"] == 5000

    def test_convert_nested_camel_to_snake_keys(self):
        """Test conversion works recursively on nested dicts."""
        data = {
            "scrapeOptions": {
                "includeTags": ["article"],
                "waitFor": 2000,
            }
        }
        result = convert_camel_to_snake_keys(data)

        assert "scrape_options" in result
        assert "include_tags" in result["scrape_options"]
        assert "wait_for" in result["scrape_options"]

    def test_convert_preserves_snake_case_keys(self):
        """Test that snake_case keys are preserved."""
        data = {
            "include_tags": ["h1"],
            "only_main_content": True,
            "url": "https://example.com",
        }
        result = convert_camel_to_snake_keys(data)

        assert result == data


class TestScrapeOptionsCamelCaseAlias:
    """Test that ScrapeOptions accepts camelCase keys."""

    def test_scrape_options_camel_case_keys(self):
        """Test ScrapeOptions accepts camelCase keys and converts them."""
        options = ScrapeOptions(**{
            "includeTags": ["h1", "h2"],
            "excludeTags": ["nav"],
            "onlyMainContent": False,
            "waitFor": 2000,
            "skipTlsVerification": True,
            "removeBase64Images": False,
            "fastMode": True,
            "blockAds": True,
            "storeInCache": False,
            "maxAge": 5000,
        })

        assert options.include_tags == ["h1", "h2"]
        assert options.exclude_tags == ["nav"]
        assert options.only_main_content is False
        assert options.wait_for == 2000
        assert options.skip_tls_verification is True
        assert options.remove_base64_images is False
        assert options.fast_mode is True
        assert options.block_ads is True
        assert options.store_in_cache is False
        assert options.max_age == 5000

    def test_scrape_options_mixed_case_keys(self):
        """Test ScrapeOptions accepts mixed snake_case and camelCase."""
        options = ScrapeOptions(**{
            "include_tags": ["h1"],
            "onlyMainContent": True,
            "wait_for": 1000,
            "maxAge": 3000,
        })

        assert options.include_tags == ["h1"]
        assert options.only_main_content is True
        assert options.wait_for == 1000
        assert options.max_age == 3000

    def test_scrape_options_snake_case_still_works(self):
        """Test ScrapeOptions still accepts snake_case (regression test)."""
        options = ScrapeOptions(
            include_tags=["h1", "h2"],
            exclude_tags=["nav"],
            only_main_content=False,
            wait_for=2000,
        )

        assert options.include_tags == ["h1", "h2"]
        assert options.exclude_tags == ["nav"]
        assert options.only_main_content is False
        assert options.wait_for == 2000


class TestCrawlRequestCamelCaseAlias:
    """Test that CrawlRequest accepts camelCase keys."""

    def test_crawl_request_camel_case_keys(self):
        """Test CrawlRequest accepts camelCase keys and converts them."""
        request = CrawlRequest(**{
            "url": "https://example.com",
            "maxDiscoveryDepth": 3,
            "excludePaths": ["/admin"],
            "includePaths": ["/blog"],
            "ignoreQueryParameters": True,
            "crawlEntireDomain": True,
            "allowExternalLinks": False,
            "allowSubdomains": True,
            "maxConcurrency": 5,
            "zeroDataRetention": True,
        })

        assert request.url == "https://example.com"
        assert request.max_discovery_depth == 3
        assert request.exclude_paths == ["/admin"]
        assert request.include_paths == ["/blog"]
        assert request.ignore_query_parameters is True
        assert request.crawl_entire_domain is True
        assert request.allow_external_links is False
        assert request.allow_subdomains is True
        assert request.max_concurrency == 5
        assert request.zero_data_retention is True

    def test_crawl_request_with_nested_scrape_options(self):
        """Test CrawlRequest with nested scrapeOptions in camelCase."""
        request = CrawlRequest(**{
            "url": "https://example.com",
            "maxDiscoveryDepth": 2,
            "scrapeOptions": {
                "includeTags": ["article"],
                "waitFor": 1000,
            }
        })

        assert request.max_discovery_depth == 2
        assert request.scrape_options is not None
        assert request.scrape_options.include_tags == ["article"]
        assert request.scrape_options.wait_for == 1000


class TestMapOptionsCamelCaseAlias:
    """Test that MapOptions accepts camelCase keys."""

    def test_map_options_camel_case_keys(self):
        """Test MapOptions accepts camelCase keys and converts them."""
        options = MapOptions(**{
            "includeSubdomains": True,
            "ignoreQueryParameters": False,
        })

        assert options.include_subdomains is True
        assert options.ignore_query_parameters is False


class TestExtractRequestCamelCaseAlias:
    """Test that ExtractRequest accepts camelCase keys."""

    def test_extract_request_camel_case_keys(self):
        """Test ExtractRequest accepts camelCase keys and converts them."""
        request = ExtractRequest(**{
            "urls": ["https://example.com"],
            "prompt": "Extract data",
            "systemPrompt": "You are a data extractor",
            "allowExternalLinks": True,
            "enableWebSearch": False,
            "showSources": True,
            "ignoreInvalidUrls": True,
        })

        assert request.urls == ["https://example.com"]
        assert request.prompt == "Extract data"
        assert request.system_prompt == "You are a data extractor"
        assert request.allow_external_links is True
        assert request.enable_web_search is False
        assert request.show_sources is True
        assert request.ignore_invalid_urls is True


class TestSearchRequestCamelCaseAlias:
    """Test that SearchRequest accepts camelCase keys."""

    def test_search_request_camel_case_keys(self):
        """Test SearchRequest accepts camelCase keys and converts them."""
        request = SearchRequest(**{
            "query": "test query",
            "ignoreInvalidUrls": True,
            "scrapeOptions": {
                "includeTags": ["article"],
            }
        })

        assert request.query == "test query"
        assert request.ignore_invalid_urls is True
        assert request.scrape_options is not None
        assert request.scrape_options.include_tags == ["article"]


class TestBatchScrapeRequestCamelCaseAlias:
    """Test that BatchScrapeRequest accepts camelCase keys."""

    def test_batch_scrape_request_camel_case_keys(self):
        """Test BatchScrapeRequest accepts camelCase keys and converts them."""
        request = BatchScrapeRequest(**{
            "urls": ["https://example.com"],
            "appendToId": "job-123",
            "ignoreInvalidUrls": True,
            "maxConcurrency": 10,
            "zeroDataRetention": True,
        })

        assert request.urls == ["https://example.com"]
        assert request.append_to_id == "job-123"
        assert request.ignore_invalid_urls is True
        assert request.max_concurrency == 10
        assert request.zero_data_retention is True